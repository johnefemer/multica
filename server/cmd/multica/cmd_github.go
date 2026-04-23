package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"time"

	"github.com/spf13/cobra"
)

var githubCmd = &cobra.Command{
	Use:   "github",
	Short: "GitHub integration commands",
	Long:  "Interact with GitHub from within an Agenthost agent runtime.",
}

var githubStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show GitHub authentication status for this runtime",
	RunE:  runGitHubStatus,
}

var githubPRCreateCmd = &cobra.Command{
	Use:   "pr create",
	Short: "Create a GitHub pull request",
	RunE:  runGitHubPRCreate,
}

var githubRunListCmd = &cobra.Command{
	Use:   "run list",
	Short: "List recent GitHub Actions workflow runs",
	RunE:  runGitHubRunList,
}

var githubRunWatchCmd = &cobra.Command{
	Use:   "run watch <run-id>",
	Short: "Watch a GitHub Actions workflow run until it completes",
	Args:  exactArgs(1),
	RunE:  runGitHubRunWatch,
}

var githubTokenStatusCmd = &cobra.Command{
	Use:   "token status",
	Short: "Show the active GitHub token source and scopes",
	RunE:  runGitHubTokenStatus,
}

func init() {
	// pr create flags
	githubPRCreateCmd.Flags().String("title", "", "PR title (required)")
	githubPRCreateCmd.Flags().String("body", "", "PR body")
	githubPRCreateCmd.Flags().String("base", "", "Base branch (defaults to repo default)")
	githubPRCreateCmd.Flags().Bool("draft", false, "Create as draft PR")
	_ = githubPRCreateCmd.MarkFlagRequired("title")

	// run list flags
	githubRunListCmd.Flags().Int("limit", 10, "Max number of runs to return")
	githubRunListCmd.Flags().String("workflow", "", "Filter by workflow name or filename")

	// Build the tree
	var prCmd = &cobra.Command{Use: "pr", Short: "Pull request operations"}
	prCmd.AddCommand(githubPRCreateCmd)

	var runCmd = &cobra.Command{Use: "run", Short: "GitHub Actions run operations"}
	runCmd.AddCommand(githubRunListCmd)
	runCmd.AddCommand(githubRunWatchCmd)

	var tokenCmd = &cobra.Command{Use: "token", Short: "GitHub token operations"}
	tokenCmd.AddCommand(githubTokenStatusCmd)

	githubCmd.AddCommand(githubStatusCmd)
	githubCmd.AddCommand(prCmd)
	githubCmd.AddCommand(runCmd)
	githubCmd.AddCommand(tokenCmd)
}

// ghExec runs a `gh` subcommand, forwarding GH_TOKEN from the environment.
// Returns the combined stdout output on success.
func ghExec(args ...string) ([]byte, error) {
	cmd := exec.Command("gh", args...)
	cmd.Env = os.Environ() // GH_TOKEN is already in the environment (injected by daemon)
	return cmd.Output()
}

func runGitHubStatus(cmd *cobra.Command, _ []string) error {
	out, err := ghExec("auth", "status")
	if err != nil {
		return fmt.Errorf("gh auth status failed (is gh CLI installed and authenticated?): %w", err)
	}
	fmt.Fprintf(os.Stdout, "%s\n", string(out))
	return nil
}

func runGitHubPRCreate(cmd *cobra.Command, _ []string) error {
	title, _ := cmd.Flags().GetString("title")
	body, _ := cmd.Flags().GetString("body")
	base, _ := cmd.Flags().GetString("base")
	draft, _ := cmd.Flags().GetBool("draft")

	args := []string{"pr", "create", "--title", title, "--json", "url,number,title,state"}
	if body != "" {
		args = append(args, "--body", body)
	} else {
		args = append(args, "--body", "")
	}
	if base != "" {
		args = append(args, "--base", base)
	}
	if draft {
		args = append(args, "--draft")
	}

	out, err := ghExec(args...)
	if err != nil {
		return fmt.Errorf("gh pr create failed: %w", err)
	}
	fmt.Fprintf(os.Stdout, "%s\n", string(out))
	return nil
}

func runGitHubRunList(cmd *cobra.Command, _ []string) error {
	limit, _ := cmd.Flags().GetInt("limit")
	workflow, _ := cmd.Flags().GetString("workflow")

	args := []string{"run", "list", "--json", "databaseId,name,status,conclusion,startedAt,event,headBranch",
		"--limit", fmt.Sprintf("%d", limit)}
	if workflow != "" {
		args = append(args, "--workflow", workflow)
	}

	out, err := ghExec(args...)
	if err != nil {
		return fmt.Errorf("gh run list failed: %w", err)
	}
	fmt.Fprintf(os.Stdout, "%s\n", string(out))
	return nil
}

func runGitHubRunWatch(cmd *cobra.Command, args []string) error {
	runID := args[0]
	out, err := ghExec("run", "watch", runID)
	if err != nil {
		return fmt.Errorf("gh run watch failed: %w", err)
	}
	fmt.Fprintf(os.Stdout, "%s\n", string(out))
	return nil
}

func runGitHubTokenStatus(_ *cobra.Command, _ []string) error {
	token := os.Getenv("GH_TOKEN")
	if token == "" {
		token = os.Getenv("GITHUB_TOKEN")
	}

	if token == "" {
		fmt.Fprintln(os.Stdout, "No GitHub token available in environment.")
		fmt.Fprintln(os.Stdout, "To configure a token, set it in runtime settings via the Agenthost UI.")
		return nil
	}

	// Show a masked preview.
	preview := token
	if len(token) > 8 {
		preview = token[:4] + "****" + token[len(token)-4:]
	}

	// Determine the token source.
	source := "environment (GH_TOKEN/GITHUB_TOKEN)"
	if os.Getenv("GH_TOKEN") == "" && os.Getenv("GITHUB_TOKEN") != "" {
		source = "environment (GITHUB_TOKEN)"
	}

	fmt.Fprintf(os.Stdout, "Token: %s\nSource: %s\n", preview, source)

	// Validate the token via the GitHub API.
	if err := validateGitHubToken(token); err != nil {
		fmt.Fprintf(os.Stdout, "Validation: %s\n", err.Error())
	} else {
		fmt.Fprintln(os.Stdout, "Validation: OK")
	}

	return nil
}

// validateGitHubToken makes a lightweight API call to confirm the token is valid.
func validateGitHubToken(token string) error {
	req, err := http.NewRequest(http.MethodGet, "https://api.github.com/user", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("API call failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if resp.StatusCode == http.StatusUnauthorized {
		return fmt.Errorf("token is invalid or expired (401)")
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status %d: %s", resp.StatusCode, bytes.TrimSpace(body))
	}

	var user struct {
		Login string `json:"login"`
	}
	if err := json.Unmarshal(body, &user); err == nil && user.Login != "" {
		fmt.Fprintf(os.Stdout, "Authenticated as: %s\n", user.Login)
	}
	return nil
}
