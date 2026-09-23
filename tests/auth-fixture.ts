import { vi } from "vitest";
const account = vi.hoisted(() => ({
  user: {
    id: "local",
    name: "Test Account",
    email: "test@example.test",
    emailVerified: true,
  } as null | {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
  },
}));
vi.mock("../apps/editor/lib/auth-server", () => ({
  getAuth: () => ({
    getSession: async () => ({
      data: account.user ? { user: account.user } : null,
      error: null,
    }),
  }),
}));

export { account };
