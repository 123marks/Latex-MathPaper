const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 256;

export function passwordPolicyError(password) {
  if (!password) return "";
  if (password.length > MAX_PASSWORD_LENGTH) return "密码过长";
  if (password.length < MIN_PASSWORD_LENGTH) return "密码至少需要 10 位";
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/]
    .filter((pattern) => pattern.test(password)).length;
  if (classes < 2) return "需包含大小写字母、数字或符号中的至少两类";
  return "";
}

export function passwordConfirmationError(password, confirmation) {
  if (!confirmation) return "";
  return password === confirmation ? "" : "两次输入的密码不一致";
}

export { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH };
