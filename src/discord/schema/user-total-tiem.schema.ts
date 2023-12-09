import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class UserTotalTime extends Document {
  @Prop()
  discordName: string;

  @Prop()
  discordId: string;

  @Prop({
    type: Object,  // ระบุชนิดของข้อมูลที่ถูกต้อง (object)
  })
  totalTime: {
    hours: string;
    minutes: string;
    seconds: string;
  };

  @Prop()
  timestamp: string;  // แก้ชื่อ field เป็น timestamp
}

export const UserTotalTimeSchema = SchemaFactory.createForClass(UserTotalTime);
