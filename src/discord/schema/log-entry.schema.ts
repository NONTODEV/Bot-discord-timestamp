import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class LogEntry extends Document {
  @Prop()
  username: string;

  @Prop()
  userId: string;

  @Prop()
  action: string;

  @Prop()
  timestamp: Date;
}

export const LogEntrySchema = SchemaFactory.createForClass(LogEntry);