import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "../api/client";
import { ApiError } from "../api/client";
import type { StorageAdapter, User } from "../types";
import { createAuthStore } from "./store";

const fakeUser: User = {
  id: "u1",
  name: "Alice",
  email: "alice@example.com",
  avatar_url: null,
} as User;

function makeStorage(initial: Record<string, string> = {}): StorageAdapter & {
  snapshot: () => Record<string, string>;
} {
  const data = { ...initial };
  return {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
    snapshot: () => ({ ...data }),
  };
}

function makeApi(getMe: () => Promise<User>): ApiClient {
  return {
    setToken: vi.fn(),
    getMe,
    // Only the methods touched by store.initialize are needed. Cast to
    // ApiClient for type compatibility — the store treats it opaquely.
  } as unknown as ApiClient;
}

describe("authStore.initialize — token mode", () => {
  it("keeps the stored token when getMe fails with a non-401 ApiError (e.g. 500)", async () => {
    const storage = makeStorage({ multica_token: "t" });
    const api = makeApi(() =>
      Promise.reject(new ApiError("server error", 500, "Internal Server Error")),
    );
    const store = createAuthStore({ api, storage });

    await store.getState().initialize();

    expect(store.getState().user).toBeNull();
    expect(store.getState().isLoading).toBe(false);
    expect(storage.snapshot().multica_token).toBe("t");
  });

  it("keeps the stored token on a network failure (non-ApiError throw)", async () => {
    const storage = makeStorage({ multica_token: "t" });
    const api = makeApi(() => Promise.reject(new TypeError("fetch failed")));
    const store = createAuthStore({ api, storage });

    await store.getState().initialize();

    expect(store.getState().user).toBeNull();
    expect(storage.snapshot().multica_token).toBe("t");
  });

  it("on 401, leaves storage cleanup to ApiClient.onUnauthorized and resets state", async () => {
    // Simulate the real path: ApiClient fires onUnauthorized on 401, which
    // removes the token from storage. The store's catch block must not
    // duplicate or short-circuit this — it should only reset in-memory
    // auth state.
    const storage = makeStorage({ multica_token: "t" });
    const api = makeApi(() => {
      storage.removeItem("multica_token"); // stand-in for onUnauthorized
      return Promise.reject(new ApiError("unauthorized", 401, "Unauthorized"));
    });
    const store = createAuthStore({ api, storage });

    await store.getState().initialize();

    expect(store.getState().user).toBeNull();
    expect(storage.snapshot().multica_token).toBeUndefined();
  });

  it("populates user when getMe succeeds", async () => {
    const storage = makeStorage({ multica_token: "t" });
    const api = makeApi(() => Promise.resolve(fakeUser));
    const store = createAuthStore({ api, storage });

    await store.getState().initialize();

    expect(store.getState().user).toEqual(fakeUser);
    expect(storage.snapshot().multica_token).toBe("t");
  });
});

describe("authStore.loginWithPassword", () => {
  function makeLoginApi(passwordLogin: ApiClient["passwordLogin"]): ApiClient {
    return {
      setToken: vi.fn(),
      passwordLogin,
    } as unknown as ApiClient;
  }

  it("persists the token and publishes the user in token mode", async () => {
    const storage = makeStorage();
    const api = makeLoginApi(() =>
      Promise.resolve({ token: "fresh-jwt", user: fakeUser }),
    );
    const onLogin = vi.fn();
    const store = createAuthStore({ api, storage, onLogin });

    const user = await store
      .getState()
      .loginWithPassword("alice@example.com", "hunter2hunter2");

    expect(user).toEqual(fakeUser);
    expect(store.getState().user).toEqual(fakeUser);
    expect(storage.snapshot().multica_token).toBe("fresh-jwt");
    expect(api.setToken).toHaveBeenCalledWith("fresh-jwt");
    expect(onLogin).toHaveBeenCalled();
  });

  it("does not touch storage in cookie mode", async () => {
    const storage = makeStorage();
    const api = makeLoginApi(() =>
      Promise.resolve({ token: "fresh-jwt", user: fakeUser }),
    );
    const store = createAuthStore({ api, storage, cookieAuth: true });

    await store
      .getState()
      .loginWithPassword("alice@example.com", "hunter2hunter2");

    expect(store.getState().user).toEqual(fakeUser);
    expect(storage.snapshot().multica_token).toBeUndefined();
    expect(api.setToken).not.toHaveBeenCalled();
  });

  it("propagates the failure and leaves the session untouched", async () => {
    const storage = makeStorage();
    const api = makeLoginApi(() =>
      Promise.reject(new ApiError("invalid email or password", 401, "Unauthorized")),
    );
    const onLogin = vi.fn();
    const store = createAuthStore({ api, storage, onLogin });

    await expect(
      store.getState().loginWithPassword("alice@example.com", "nope"),
    ).rejects.toThrow("invalid email or password");

    expect(store.getState().user).toBeNull();
    expect(storage.snapshot().multica_token).toBeUndefined();
    expect(onLogin).not.toHaveBeenCalled();
  });
});
