export const listUsers = async (query: any) => {
    // TODO: Fetch all users, optionally filtered by type
    return [];
};

export const getUser = async (userId: string) => {
    // TODO: Fetch user and profile by ID
    return { id: userId };
};

export const updateUser = async (userId: string, data: any) => {
    // TODO: Update user info
    return { id: userId, ...data };
};

export const updateUserStatus = async (userId: string, status: string) => {
    // TODO: Update user status (activate/deactivate)
    return { id: userId, status };
};

export const deleteUser = async (userId: string) => {
    // TODO: Delete user (soft or hard)
};