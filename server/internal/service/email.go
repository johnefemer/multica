package service

import (
	"fmt"
	"html"
	"os"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/resend/resend-go/v2"
)

// maxSubjectFieldRunes bounds how much user-controlled text (workspace name,
// inviter name) can land in an email Subject. Prevents attackers from stuffing
// a full phishing pitch into a workspace name that gets sent from our domain.
const maxSubjectFieldRunes = 60

type EmailService struct {
	client    *resend.Client
	fromEmail string
}

func appName() string {
	if name := strings.TrimSpace(os.Getenv("APP_NAME")); name != "" {
		return name
	}
	return "Agenthost by Kensink Labs"
}

func NewEmailService() *EmailService {
	apiKey := os.Getenv("RESEND_API_KEY")
	from := os.Getenv("RESEND_FROM_EMAIL")
	if from == "" {
		from = "noreply@kensink.com"
	}

	var client *resend.Client
	if apiKey != "" {
		client = resend.NewClient(apiKey)
	}

	return &EmailService{
		client:    client,
		fromEmail: from,
	}
}

// SendVerificationCode sends a one-time login code. The code is server-generated
// (6-digit numeric) so no user-controlled text reaches the email body here.
// If that ever changes, escape the user-controlled fields the same way
// SendInvitationEmail does.
func (s *EmailService) SendVerificationCode(to, code string) error {
	if s.client == nil {
		fmt.Printf("[DEV] Verification code for %s: %s\n", to, code)
		return nil
	}

	params := &resend.SendEmailRequest{
		From:    s.fromEmail,
		To:      []string{to},
		Subject: fmt.Sprintf("Your %s verification code", appName()),
		Html: fmt.Sprintf(
			`<div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
				<h2>Your verification code</h2>
				<p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 24px 0;">%s</p>
				<p>This code expires in 10 minutes.</p>
				<p style="color: #666; font-size: 14px;">If you didn't request this code, you can safely ignore this email.</p>
			</div>`, code),
	}

	_, err := s.client.Emails.Send(params)
	return err
}

// SendInvitationEmail notifies the invitee that they have been invited to a workspace.
// invitationID is included in the URL so the email deep-links to /invite/{id}.
func (s *EmailService) SendInvitationEmail(to, inviterName, workspaceName, invitationID string) error {
	appURL := strings.TrimSpace(os.Getenv("FRONTEND_ORIGIN"))
	if appURL == "" {
		appURL = "https://agenthost.pro"
	}
	inviteURL := fmt.Sprintf("%s/invite/%s", appURL, invitationID)

	if s.client == nil {
		fmt.Printf("[DEV] Invitation email to %s: %s invited you to %s — %s\n", to, inviterName, workspaceName, inviteURL)
		return nil
	}

	params := buildInvitationParams(s.fromEmail, to, inviterName, workspaceName, inviteURL)
	_, err := s.client.Emails.Send(params)
	return err
}

// buildInvitationParams assembles the Resend request for an invitation email.
// Separated from SendInvitationEmail so the sanitization behavior is unit-testable
// without needing to mock the Resend SDK.
func buildInvitationParams(from, to, inviterName, workspaceName, inviteURL string) *resend.SendEmailRequest {
	safeWorkspace := html.EscapeString(workspaceName)
	safeInviter := html.EscapeString(inviterName)
	subjectInviter := sanitizeSubjectField(inviterName)
	subjectWorkspace := sanitizeSubjectField(workspaceName)

	return &resend.SendEmailRequest{
		From:    from,
		To:      []string{to},
		Subject: fmt.Sprintf("%s invited you to %s on %s", subjectInviter, subjectWorkspace, appName()),
		Html: fmt.Sprintf(
			`<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
				<h2>You're invited to join %s</h2>
				<p><strong>%s</strong> invited you to collaborate in the <strong>%s</strong> workspace on %s.</p>
				<p style="margin: 24px 0;">
					<a href="%s" style="display: inline-block; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 500;">Accept invitation</a>
				</p>
				<p style="color: #666; font-size: 14px;">You'll need to log in to accept or decline the invitation.</p>
			</div>`, safeWorkspace, safeInviter, safeWorkspace, html.EscapeString(appName()), inviteURL),
	}
}

// ContactInquiry is the structured payload assembled by the public /api/contact
// handler before forwarding to the founder inbox. All fields are user-controlled
// and must be escaped on the way into the HTML body.
type ContactInquiry struct {
	Name      string
	Email     string
	Company   string
	Topic     string
	Message   string
	IPAddress string
	UserAgent string
}

// SendContactForm forwards a public-form inquiry to the configured founder
// inbox (CONTACT_INBOX env var, defaults to agenthost@kensink.com). The
// `Reply-To` header is set to the submitter's email so a single click replies
// to them, not to our `From` address. Subject carries the topic + name; body
// is plain HTML with all user-controlled fields HTML-escaped to prevent the
// inbox from rendering injected markup.
func (s *EmailService) SendContactForm(inquiry ContactInquiry) error {
	to := strings.TrimSpace(os.Getenv("CONTACT_INBOX"))
	if to == "" {
		to = "agenthost@kensink.com"
	}

	if s.client == nil {
		fmt.Printf("[DEV] Contact form to %s: [%s] %s <%s> — %.80s…\n",
			to, inquiry.Topic, inquiry.Name, inquiry.Email, inquiry.Message)
		return nil
	}

	subjectName := sanitizeSubjectField(inquiry.Name)
	subjectTopic := sanitizeSubjectField(inquiry.Topic)
	subject := fmt.Sprintf("[%s] %s — Agenthost contact form", subjectTopic, subjectName)

	safeName := html.EscapeString(inquiry.Name)
	safeEmail := html.EscapeString(inquiry.Email)
	safeCompany := html.EscapeString(inquiry.Company)
	safeTopic := html.EscapeString(inquiry.Topic)
	// Preserve newlines as <br/> for readability; escape first so user-supplied
	// markup is rendered as literal text.
	safeMessage := strings.ReplaceAll(html.EscapeString(inquiry.Message), "\n", "<br>")
	safeIP := html.EscapeString(inquiry.IPAddress)
	safeUA := html.EscapeString(inquiry.UserAgent)

	companyRow := ""
	if strings.TrimSpace(inquiry.Company) != "" {
		companyRow = fmt.Sprintf(`<tr><td style="padding: 4px 12px 4px 0; color: #666;">Company</td><td style="padding: 4px 0;">%s</td></tr>`, safeCompany)
	}

	params := &resend.SendEmailRequest{
		From:    s.fromEmail,
		To:      []string{to},
		ReplyTo: inquiry.Email,
		Subject: subject,
		Html: fmt.Sprintf(
			`<div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
				<h2 style="margin: 0 0 16px;">New contact form submission</h2>
				<table style="border-collapse: collapse; font-size: 14px; margin-bottom: 18px;">
					<tr><td style="padding: 4px 12px 4px 0; color: #666;">Name</td><td style="padding: 4px 0;">%s</td></tr>
					<tr><td style="padding: 4px 12px 4px 0; color: #666;">Email</td><td style="padding: 4px 0;"><a href="mailto:%s">%s</a></td></tr>
					%s
					<tr><td style="padding: 4px 12px 4px 0; color: #666;">Topic</td><td style="padding: 4px 0;">%s</td></tr>
				</table>
				<div style="border-left: 3px solid #7cf29c; padding: 12px 16px; background: #f6fff9; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">%s</div>
				<p style="color: #999; font-size: 12px; margin-top: 24px;">Sent via <a href="https://agenthost.pro/contact" style="color: #999;">agenthost.pro/contact</a> · IP %s · UA %s</p>
			</div>`,
			safeName, safeEmail, safeEmail, companyRow, safeTopic, safeMessage, safeIP, safeUA,
		),
	}

	_, err := s.client.Emails.Send(params)
	return err
}

// sanitizeSubjectField prepares user-controlled text for the email Subject line.
// Subject is not HTML-rendered, so HTML-escaping would leak literal entities
// (e.g. &lt;script&gt;) into the recipient's inbox. Instead strip control
// characters (defense in depth against header-injection-adjacent abuse even
// though Resend also filters CR/LF) and cap length so attackers can't stuff
// a full phishing subject into a workspace name.
func sanitizeSubjectField(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		if unicode.IsControl(r) {
			continue
		}
		b.WriteRune(r)
	}
	cleaned := b.String()
	if utf8.RuneCountInString(cleaned) <= maxSubjectFieldRunes {
		return cleaned
	}
	runes := []rune(cleaned)
	return string(runes[:maxSubjectFieldRunes-1]) + "…"
}
