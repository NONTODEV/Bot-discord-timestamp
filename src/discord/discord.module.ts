import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DiscordService } from './discord.service';
import { LogEntry, LogEntrySchema } from './schema/log-entry.schema';
import { LogLeave, LogLeaveSchema } from './schema/log-leave.schema';
import { UserTotalTime, UserTotalTimeSchema } from './schema/user-total-tiem.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LogEntry.name, schema: LogEntrySchema },
      { name: LogLeave.name, schema: LogLeaveSchema },
      { name: UserTotalTime.name, schema: UserTotalTimeSchema },
    ]),
  ],
  providers: [DiscordService],
})
export class DiscordModule {}
