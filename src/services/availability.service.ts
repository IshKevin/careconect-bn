import { eq, and, or, sql } from 'drizzle-orm';
import { db } from '../config/database';
import { users, userProfiles, doctors, doctorAvailability, appointments } from '../db/schemas';
import {
  AvailabilityFilters,
  UpdateDoctorAvailability,
  InsertDoctorAvailability,
  AvailabilityWithDoctor,
  SetDoctorAvailability,
  GetAvailableSlots,
  BulkUpdateAvailability,
  WeeklySchedule,
  DoctorScheduleSummary,
  TimeSlot,
  daysOfWeek,
} from '../db/schemas/doctor-availability';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';
import { v4 as uuidv4 } from 'uuid';

export class AvailabilityService {
  // Get doctor availability
  async getDoctorAvailability(doctorId: string, filters?: Pick<AvailabilityFilters, 'dayOfWeek' | 'isActive'>): Promise<AvailabilityWithDoctor[]> {
    // Verify doctor exists
    const doctor = await db
      .select()
      .from(doctors)
      .where(eq(doctors.doctorId, doctorId))
      .limit(1);

    if (!doctor[0]) {
      throw new NotFoundError('Doctor');
    }

    // Build conditions
    const conditions: any[] = [eq(doctorAvailability.doctorId, doctorId)];

    if (filters?.dayOfWeek !== undefined) {
      conditions.push(eq(doctorAvailability.dayOfWeek, filters.dayOfWeek));
    }

    if (filters?.isActive !== undefined) {
      conditions.push(eq(doctorAvailability.isActive, filters.isActive));
    }

    const results = await db
      .select({
        availabilityId: doctorAvailability.availabilityId,
        doctorId: doctorAvailability.doctorId,
        dayOfWeek: doctorAvailability.dayOfWeek,
        startTime: doctorAvailability.startTime,
        endTime: doctorAvailability.endTime,
        slotDuration: doctorAvailability.slotDuration,
        isActive: doctorAvailability.isActive,
        createdAt: doctorAvailability.createdAt,
        updatedAt: doctorAvailability.updatedAt,
        // Doctor info
        doctorUserId: doctors.userId,
        doctorSpecialty: doctors.specialty,
        doctorConsultationFee: doctors.consultationFee,
        doctorIsActive: doctors.isActive,
      })
      .from(doctorAvailability)
      .leftJoin(doctors, eq(doctorAvailability.doctorId, doctors.doctorId))
      .where(and(...conditions));

    return results.map((availability) => ({
      availabilityId: availability.availabilityId,
      doctorId: availability.doctorId,
      dayOfWeek: availability.dayOfWeek,
      startTime: availability.startTime,
      endTime: availability.endTime,
      slotDuration: availability.slotDuration,
      isActive: availability.isActive,
      createdAt: availability.createdAt,
      updatedAt: availability.updatedAt,
      doctor: {
        userId: availability.doctorUserId,
        specialty: availability.doctorSpecialty,
        consultationFee: availability.doctorConsultationFee,
        isActive: availability.doctorIsActive,
      },
    }));
  }

  // Add availability slot
  async addAvailability(data: InsertDoctorAvailability): Promise<AvailabilityWithDoctor> {
    const { doctorId } = data;

    // Verify doctor exists
    const doctor = await db
      .select()
      .from(doctors)
      .where(eq(doctors.doctorId, doctorId))
      .limit(1);

    if (!doctor[0]) {
      throw new NotFoundError('Doctor');
    }

    // Check for overlapping availability
    const overlapping = await db
      .select()
      .from(doctorAvailability)
      .where(
        and(
          eq(doctorAvailability.doctorId, doctorId),
          eq(doctorAvailability.dayOfWeek, data.dayOfWeek),
          eq(doctorAvailability.isActive, true),
          or(
            // New slot starts within existing slot
            and(
              sql`${doctorAvailability.startTime} <= ${data.startTime}`,
              sql`${doctorAvailability.endTime} > ${data.startTime}`
            ),
            // New slot ends within existing slot
            and(
              sql`${doctorAvailability.startTime} < ${data.endTime}`,
              sql`${doctorAvailability.endTime} >= ${data.endTime}`
            ),
            // New slot encompasses existing slot
            and(
              sql`${data.startTime} <= ${doctorAvailability.startTime}`,
              sql`${data.endTime} >= ${doctorAvailability.endTime}`
            )
          )
        )
      )
      .limit(1);

    if (overlapping[0]) {
      throw new ConflictError('Availability slot overlaps with existing schedule');
    }

    // Create availability
    const availabilityId = uuidv4();
    await db.insert(doctorAvailability).values({
      availabilityId,
      doctorId: data.doctorId,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      slotDuration: data.slotDuration || 30,
      isActive: data.isActive ?? true,
    });

    const result = await this.getDoctorAvailability(doctorId, { isActive: true });
    return result.find(a => a.availabilityId === availabilityId)!;
  }

  // Update availability slot
  async updateAvailability(availabilityId: string, data: UpdateDoctorAvailability): Promise<AvailabilityWithDoctor> {
    const availability = await db
      .select()
      .from(doctorAvailability)
      .where(eq(doctorAvailability.availabilityId, availabilityId))
      .limit(1);

    if (!availability[0]) {
      throw new NotFoundError('Availability slot');
    }

    // If updating time or day, check for conflicts
    if (data.dayOfWeek !== undefined || data.startTime || data.endTime) {
      const updatedDayOfWeek = data.dayOfWeek ?? availability[0].dayOfWeek;
      const updatedStartTime = data.startTime ?? availability[0].startTime;
      const updatedEndTime = data.endTime ?? availability[0].endTime;

      const overlapping = await db
        .select()
        .from(doctorAvailability)
        .where(
          and(
            eq(doctorAvailability.doctorId, availability[0].doctorId),
            eq(doctorAvailability.dayOfWeek, updatedDayOfWeek),
            sql`${doctorAvailability.availabilityId} != ${availabilityId}`,
            eq(doctorAvailability.isActive, true),
            or(
              and(
                sql`${doctorAvailability.startTime} <= ${updatedStartTime}`,
                sql`${doctorAvailability.endTime} > ${updatedStartTime}`
              ),
              and(
                sql`${doctorAvailability.startTime} < ${updatedEndTime}`,
                sql`${doctorAvailability.endTime} >= ${updatedEndTime}`
              ),
              and(
                sql`${updatedStartTime} <= ${doctorAvailability.startTime}`,
                sql`${updatedEndTime} >= ${doctorAvailability.endTime}`
              )
            )
          )
        )
        .limit(1);

      if (overlapping[0]) {
        throw new ConflictError('Updated availability slot would overlap with existing schedule');
      }
    }

    await db
      .update(doctorAvailability)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(doctorAvailability.availabilityId, availabilityId));

    const result = await this.getDoctorAvailability(availability[0].doctorId);
    return result.find(a => a.availabilityId === availabilityId)!;
  }

  // Update availability status
  async updateAvailabilityStatus(availabilityId: string, isActive: boolean): Promise<AvailabilityWithDoctor> {
    const availability = await db
      .select()
      .from(doctorAvailability)
      .where(eq(doctorAvailability.availabilityId, availabilityId))
      .limit(1);

    if (!availability[0]) {
      throw new NotFoundError('Availability slot');
    }

    await db
      .update(doctorAvailability)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(doctorAvailability.availabilityId, availabilityId));

    const result = await this.getDoctorAvailability(availability[0].doctorId);
    return result.find(a => a.availabilityId === availabilityId)!;
  }

  // Delete availability slot
  async deleteAvailability(availabilityId: string): Promise<void> {
    const availability = await db
      .select()
      .from(doctorAvailability)
      .where(eq(doctorAvailability.availabilityId, availabilityId))
      .limit(1);

    if (!availability[0]) {
      throw new NotFoundError('Availability slot');
    }

    await db.delete(doctorAvailability).where(eq(doctorAvailability.availabilityId, availabilityId));
  }

  // Set doctor availability (bulk operation)
  async setDoctorAvailability(data: SetDoctorAvailability): Promise<AvailabilityWithDoctor[]> {
    const { doctorId, schedules } = data;

    // Verify doctor exists
    const doctor = await db
      .select()
      .from(doctors)
      .where(eq(doctors.doctorId, doctorId))
      .limit(1);

    if (!doctor[0]) {
      throw new NotFoundError('Doctor');
    }

    // Delete existing availability
    await db
      .delete(doctorAvailability)
      .where(eq(doctorAvailability.doctorId, doctorId));

    // Insert new schedules
    const availabilityRecords = schedules.map(schedule => ({
      availabilityId: uuidv4(),
      doctorId,
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      slotDuration: schedule.slotDuration || 30,
      isActive: schedule.isActive ?? true,
    }));

    if (availabilityRecords.length > 0) {
      await db.insert(doctorAvailability).values(availabilityRecords);
    }

    return this.getDoctorAvailability(doctorId, { isActive: true });
  }

  // Get available time slots for a specific date
  async getAvailableSlots(data: GetAvailableSlots): Promise<TimeSlot[]> {
    const { doctorId, date, includeBooked = false } = data;

    // Get day of week from date
    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();

    // Get doctor's availability for this day
    const availability = await this.getDoctorAvailability(doctorId, {
      dayOfWeek,
      isActive: true,
    });

    if (availability.length === 0) {
      return [];
    }

    // Get booked appointments for this date
    const bookedAppointments = await db
      .select({ scheduledTime: appointments.scheduledTime })
      .from(appointments)
      .where(
        and(
          eq(appointments.doctorId, doctorId),
          eq(appointments.scheduledDate, date),
          sql`${appointments.appointmentStatus} NOT IN ('cancelled', 'no_show')`
        )
      );

    const bookedTimes = bookedAppointments.map(apt => apt.scheduledTime);
    const allSlots: TimeSlot[] = [];

    // Generate time slots for each availability period
    availability.forEach(avail => {
      const startTime = new Date(`1970-01-01T${avail.startTime}`);
      const endTime = new Date(`1970-01-01T${avail.endTime}`);
      const slotDurationMs = avail.slotDuration * 60 * 1000;

      let currentTime = startTime;
      while (currentTime < endTime) {
        const slotEndTime = new Date(currentTime.getTime() + slotDurationMs);
        if (slotEndTime <= endTime) {
          const timeString = currentTime.toTimeString().substring(0, 8);
          const endTimeString = slotEndTime.toTimeString().substring(0, 8);
          const isBooked = bookedTimes.includes(timeString);
          
          if (includeBooked || !isBooked) {
            allSlots.push({
              startTime: timeString,
              endTime: endTimeString,
              isAvailable: !isBooked,
            });
          }
        }
        currentTime = slotEndTime;
      }
    });

    return allSlots.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  // Bulk update availability status
  async bulkUpdateAvailability(data: BulkUpdateAvailability): Promise<AvailabilityWithDoctor[]> {
    const { doctorId, isActive, dayOfWeek, reason } = data;

    // Verify doctor exists
    const doctor = await db
      .select()
      .from(doctors)
      .where(eq(doctors.doctorId, doctorId))
      .limit(1);

    if (!doctor[0]) {
      throw new NotFoundError('Doctor');
    }

    // Build update conditions
    const conditions = [eq(doctorAvailability.doctorId, doctorId)];
    if (dayOfWeek !== undefined) {
      conditions.push(eq(doctorAvailability.dayOfWeek, dayOfWeek));
    }

    await db
      .update(doctorAvailability)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(and(...conditions));

    return this.getDoctorAvailability(doctorId);
  }

  // Get weekly schedule
  async getWeeklySchedule(doctorId: string): Promise<WeeklySchedule> {
    const availability = await this.getDoctorAvailability(doctorId, { isActive: true });
    
    // Group by day of week
    const scheduleByDay: { [key: number]: typeof availability } = {};
    
    availability.forEach(avail => {
      if (!scheduleByDay[avail.dayOfWeek]) {
        scheduleByDay[avail.dayOfWeek] = [];
      }
      scheduleByDay[avail.dayOfWeek].push(avail);
    });

    const week = [];
    for (let day = 0; day < 7; day++) {
      const daySchedules = scheduleByDay[day] || [];
      const dayName = daysOfWeek[day as keyof typeof daysOfWeek];
      
      week.push({
        dayOfWeek: day,
        dayName: dayName as any,
        schedules: daySchedules.map(schedule => ({
          availabilityId: schedule.availabilityId,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          slotDuration: schedule.slotDuration,
          isActive: schedule.isActive,
          totalSlots: this.calculateTotalSlots(schedule.startTime, schedule.endTime, schedule.slotDuration),
          availableSlots: 0, // Would need to calculate based on appointments
        })),
        isWorkingDay: daySchedules.length > 0,
      });
    }

    return {
      doctorId,
      week,
    };
  }

  // Calculate total slots in a time period
  private calculateTotalSlots(startTime: string, endTime: string, slotDuration: number): number {
    const start = new Date(`1970-01-01T${startTime}`);
    const end = new Date(`1970-01-01T${endTime}`);
    const durationMs = slotDuration * 60 * 1000;
    const totalMs = end.getTime() - start.getTime();
    return Math.floor(totalMs / durationMs);
  }

  // Get doctor schedule summary
  async getDoctorScheduleSummary(doctorId: string): Promise<DoctorScheduleSummary> {
    const doctor = await db
      .select({
        doctorId: doctors.doctorId,
        specialty: doctors.specialty,
        firstName: userProfiles.firstName,
        lastName: userProfiles.lastName,
      })
      .from(doctors)
      .leftJoin(users, eq(doctors.userId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(eq(doctors.doctorId, doctorId))
      .limit(1);

    if (!doctor[0]) {
      throw new NotFoundError('Doctor');
    }

    const availability = await this.getDoctorAvailability(doctorId, { isActive: true });
    
    // Calculate statistics
    const totalWeeklyHours = availability.reduce((total, avail) => {
      const start = new Date(`1970-01-01T${avail.startTime}`);
      const end = new Date(`1970-01-01T${avail.endTime}`);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      return total + hours;
    }, 0);

    const workingDays = new Set(availability.map(avail => avail.dayOfWeek)).size;
    const averageSlotDuration = availability.length > 0 
      ? availability.reduce((sum, avail) => sum + avail.slotDuration, 0) / availability.length
      : 0;

    const doctorName = doctor[0].firstName && doctor[0].lastName
      ? `${doctor[0].firstName} ${doctor[0].lastName}`
      : 'Unknown Doctor';

    return {
      doctorId,
      doctorName,
      specialty: doctor[0].specialty,
      totalWeeklyHours,
      workingDays,
      averageSlotDuration,
      isCurrentlyAvailable: availability.length > 0,
      nextAvailableSlot: undefined, // Would need complex logic to determine
    };
  }
}
