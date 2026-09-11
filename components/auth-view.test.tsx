import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthView } from "@/components/auth-view";

const mocks = vi.hoisted(() => ({
  context: {} as Record<string, unknown>,
  configureAws: vi.fn(),
  resendSignUpCode: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock("@/app/providers", () => ({ useProgress: () => mocks.context }));
vi.mock("@/lib/aws", () => ({ awsConfigured: true, configureAws: mocks.configureAws }));
vi.mock("aws-amplify/auth", () => ({
  resendSignUpCode: mocks.resendSignUpCode,
  resetPassword: mocks.resetPassword,
}));

function expectPasswordPolicy(label: "Password" | "New password") {
  const input = screen.getByLabelText(new RegExp(`^${label}`));
  expect(input).toHaveAttribute("minlength", "8");
  expect(input).toHaveAttribute("pattern", "(?=.*[a-z])(?=.*[0-9]).{8,}");
  expect(screen.getByText("At least 8 characters, including a lowercase letter and a number.")).toBeInTheDocument();
}

describe("AuthView recovery paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resendSignUpCode.mockResolvedValue(undefined);
    mocks.resetPassword.mockResolvedValue(undefined);
    mocks.context = { learner: null, refreshUser: vi.fn() };
  });

  afterEach(cleanup);

  it("toggles password visibility without submitting and hides it when switching forms", () => {
    render(<AuthView />);
    const password = screen.getByLabelText("Password");
    fireEvent.change(password, { target: { value: "example123" } });
    expect(password).toHaveAttribute("type", "password");
    const show = screen.getByRole("button", { name: "Show password" });
    expect(show).toHaveAttribute("type", "button");
    fireEvent.click(show);
    expect(password).toHaveAttribute("type", "text");
    expect(password).toHaveValue("example123");
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(mocks.configureAws).not.toHaveBeenCalled();
  });

  it("opens confirmation from a fresh sign-in screen and resends the code to the entered email", async () => {
    render(<AuthView />);
    expect(screen.getByRole("heading", { name: "Sign in to Koto" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Enter or resend a code" }));
    expect(screen.getByRole("heading", { name: "Enter your code" })).toBeInTheDocument();
    expect(screen.getByLabelText("Verification code")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "learner@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Resend verification code" }));

    await waitFor(() => expect(mocks.resendSignUpCode).toHaveBeenCalledWith({ username: "learner@example.com" }));
    expect(await screen.findByText("A new verification code was sent to your email.")).toBeInTheDocument();
  });

  it("states and enforces the lowercase, number, and eight-character policy during sign-up", () => {
    render(<AuthView />);
    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));

    expect(screen.getByRole("heading", { name: "Save your learning" })).toBeInTheDocument();
    expectPasswordPolicy("Password");
  });

  it("states and enforces the same password policy when choosing a new password", async () => {
    render(<AuthView />);
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "learner@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset code" }));

    await screen.findByRole("heading", { name: "Choose a new password" });
    expect(mocks.resetPassword).toHaveBeenCalledWith({ username: "learner@example.com" });
    expectPasswordPolicy("New password");
  });
});
