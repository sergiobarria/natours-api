import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DrizzleAuditRecorder } from '../audit/drizzle-audit-recorder.js';
import { DatabaseUnitOfWork } from '../database/database-unit-of-work.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { users, type ApplicationRole } from '../database/schema/identity.js';
import { tourGuideAssignments } from '../database/schema/tours.js';

const userSelection = {
  createdAt: users.createdAt,
  email: users.email,
  emailVerified: users.emailVerified,
  id: users.id,
  name: users.name,
  role: users.role,
  updatedAt: users.updatedAt,
};

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(DatabaseUnitOfWork) private readonly unitOfWork: DatabaseUnitOfWork,
    private readonly audit: DrizzleAuditRecorder,
  ) {}

  async find(userId: string) {
    const [user] = await this.database
      .select(userSelection)
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  list() {
    return this.database
      .select(userSelection)
      .from(users)
      .orderBy(asc(users.createdAt), asc(users.id));
  }

  updateProfile(userId: string, name: string, requestId?: string) {
    return this.unitOfWork.transaction(async transaction => {
      const [updated] = await transaction
        .update(users)
        .set({ name: name.trim() })
        .where(eq(users.id, userId))
        .returning(userSelection);
      if (!updated) throw new NotFoundException('User not found.');
      await this.audit.record(transaction, {
        action: 'user.profile_changed',
        actor: { type: 'user', userId },
        after: { changed: ['name'] },
        eventKey: randomUUID(),
        requestId,
        targetId: userId,
        targetType: 'user',
      });
      return updated;
    });
  }

  changeRole(actorId: string, targetId: string, role: ApplicationRole, requestId?: string) {
    if (actorId === targetId)
      throw new ForbiddenException('Administrators cannot change their own role.');
    return this.unitOfWork.transaction(async transaction => {
      const [existing] = await transaction
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, targetId))
        .limit(1)
        .for('update');
      if (!existing) throw new NotFoundException('User not found.');
      const assignments = await transaction
        .select({ assignmentRole: tourGuideAssignments.assignmentRole })
        .from(tourGuideAssignments)
        .where(
          and(eq(tourGuideAssignments.userId, targetId), isNull(tourGuideAssignments.deletedAt)),
        )
        .for('update');
      if (assignments.some(assignment => assignment.assignmentRole !== role)) {
        throw new UnprocessableEntityException(
          'Remove incompatible guide assignments before changing this role.',
        );
      }
      const [updated] = await transaction
        .update(users)
        .set({ role })
        .where(eq(users.id, targetId))
        .returning(userSelection);
      if (!updated) throw new NotFoundException('User not found.');
      await this.audit.record(transaction, {
        action: 'user.role_changed',
        actor: { type: 'user', userId: actorId },
        before: { role: existing.role },
        after: { role },
        eventKey: randomUUID(),
        requestId,
        targetId,
        targetType: 'user',
      });
      return updated;
    });
  }

  delete(
    actorId: string,
    targetId: string,
    administrative: boolean,
    requestId?: string,
  ): Promise<void> {
    if (administrative && actorId === targetId)
      throw new ForbiddenException('Administrators cannot delete themselves.');
    return this.unitOfWork.transaction(async transaction => {
      const [existing] = await transaction
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, targetId))
        .limit(1)
        .for('update');
      if (!existing) throw new NotFoundException('User not found.');
      const [assignment] = await transaction
        .select({ id: tourGuideAssignments.id })
        .from(tourGuideAssignments)
        .where(
          and(eq(tourGuideAssignments.userId, targetId), isNull(tourGuideAssignments.deletedAt)),
        )
        .limit(1)
        .for('update');
      if (assignment) {
        throw new UnprocessableEntityException(
          'Remove guide assignments before deleting this user.',
        );
      }
      const [deleted] = await transaction
        .delete(users)
        .where(eq(users.id, targetId))
        .returning({ id: users.id, role: users.role });
      if (!deleted) throw new NotFoundException('User not found.');
      await this.audit.record(transaction, {
        action: 'user.administered',
        actor: { type: 'user', userId: actorId },
        before: { active: true, role: deleted.role },
        after: { active: false },
        eventKey: randomUUID(),
        requestId,
        targetId,
        targetType: 'user',
      });
    });
  }
}
