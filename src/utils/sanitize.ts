// Removes secrets before a user record leaves the service layer.
export const withoutPassword = <T extends object>(row: T): Omit<T, 'passwordHash'> => {
  const { passwordHash: _passwordHash, ...safe } = row as T & { passwordHash?: unknown };
  return safe;
};
