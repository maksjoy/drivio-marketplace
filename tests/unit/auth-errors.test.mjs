import assert from "node:assert/strict";
import test from "node:test";
import {
  GENERIC_RECOVER_ERROR,
  GENERIC_SIGNUP_ERROR,
  isExistingAccountError,
  passwordUpdateError,
} from "../../lib/auth-errors.ts";

test("treats duplicate signup errors as non-enumerating", () => {
  assert.equal(isExistingAccountError({ code: "user_already_exists", message: "User already registered" }), true);
  assert.equal(isExistingAccountError({ code: "email_exists", message: "A user with this email address has already been registered" }), true);
  assert.equal(isExistingAccountError({ message: "Database error saving new user" }), false);
  assert.equal(GENERIC_SIGNUP_ERROR.includes("already"), false);
  assert.equal(GENERIC_RECOVER_ERROR.includes("@"), false);
});

test("maps password update failures without returning the provider message", () => {
  const raw = "AuthApiError: something internal about the jwt secret";
  assert.equal(passwordUpdateError({ message: raw }), "Your reset link is invalid or has expired. Request a new one.");
  assert.equal(passwordUpdateError({ code: "same_password", message: "New password should be different from the old password." }), "Choose a different password from your current one.");
  assert.equal(passwordUpdateError({ message: "relation profiles does not exist" }), "Could not update the password. Please try again.");
  assert.equal(passwordUpdateError({ message: raw }).includes("jwt secret"), false);
});
