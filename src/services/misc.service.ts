import { specialties } from '../db/schemas/doctors';

export const getSpecialties = async () => {
    return specialties;
};

export const getTimezones = async () => {
    return [
        'Africa/Kigali',
        'UTC',
        'Africa/Nairobi',
        'Africa/Kampala',
        'Africa/Dar_es_Salaam',
    ];
};

export const getHealth = async () => {
    return {
        status: 'ok',
        timestamp: new Date().toISOString(),
    };
};

export const getConfig = async () => {
    return {
        uploads: { maxSizeMb: 10, allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'] },
        notifications: { providers: ['email', 'sms'], defaultProvider: 'email' },
    };
};

export const upload = async (_file: any) => {
    return { id: 'fake-upload-id', url: 'https://example.com/fake', uploadedAt: new Date().toISOString() };
};

export const notify = async (payload: { to: string; subject: string; message: string }) => {
    return { id: 'fake-notification-id', delivered: true, to: payload.to };
};