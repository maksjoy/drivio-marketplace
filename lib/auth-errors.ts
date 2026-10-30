type AuthErrorLike = {
  message?: string;
  code?: string;
};

function text(error: AuthErrorLike) {
  return `${error.code || ""} ${error.message || ""}`.toLowerCase();
}

export function isExistingAccountError(error: AuthErrorLike) {
  const value = text(error);
  return value.includes("user_already_exists")
    || value.includes("email_exists")
    || value.includes("already registered")
    || value.includes("already been registered")
    || value.includes("user already exists");
}

export function passwordUpdateError(error: AuthErrorLike) {
  const value = text(error);
  if (value.includes("same_password") || value.includes("different from the old password") || value.includes("should be different")) {
    return "Choose a different password from your current one.";
  }
  if (
    value.includes("session_not_found")
    || value.includes("refresh_token_not_found")
    || value.includes("auth session missing")
    || value.includes("session missing")
    || value.includes("invalid claim")
    || value.includes("not authenticated")
    || value.includes("jwt")
  ) {
    return "Your reset link is invalid or has expired. Request a new one.";
  }
  if (value.includes("weak") || value.includes("easy to guess") || value.includes("pwned") || value.includes("known to be")) {
    return "Choose a stronger password.";
  }
  return "Could not update the password. Please try again.";
}

export const GENERIC_SIGNUP_ERROR = "Could not create the account. Please try again.";
export const GENERIC_RECOVER_ERROR = "Could not send a reset link. Please try again.";
