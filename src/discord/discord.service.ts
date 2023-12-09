import { Injectable } from '@nestjs/common';
import * as Discord from 'discord.js';
import { token, serverId, channelIds } from '../../config.json';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/en';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LogEntry } from './schema/log-entry.schema';
import { LogLeave } from './schema/log-leave.schema';
import { UserTotalTime } from './schema/user-total-tiem.schema';
import { TextChannel, TextChannelResolvable } from 'discord.js';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class DiscordService {
  private readonly client: Discord.Client;
  private inVoiceChannel: Map<string, string> = new Map();

  constructor(
    @InjectModel(LogEntry.name) private readonly logEntryModel: Model<LogEntry>,
    @InjectModel(LogLeave.name) private readonly logLeaveModel: Model<LogLeave>,
    @InjectModel(UserTotalTime.name) private readonly userTotalTimeModel: Model<UserTotalTime>,
  ) {
    this.client = new Discord.Client({
      intents: [
        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.GuildMembers,
        Discord.GatewayIntentBits.DirectMessages,
        Discord.GatewayIntentBits.MessageContent,
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildVoiceStates,
      ],
      partials: [
        Discord.Partials.Message,
        Discord.Partials.Channel,
        Discord.Partials.GuildMember,
        Discord.Partials.User,
        Discord.Partials.GuildScheduledEvent,
        Discord.Partials.ThreadMember,
      ],
    });

    this.client.once('ready', (client) => {
      console.log('Bot ' + client.user.tag + ' is now online!');
    });

    this.client.login(token);

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.on('voiceStateUpdate', async (oldState, newState) => {

      if (
        newState &&
        newState.channelId === channelIds.voiceChannel &&
        (oldState.channelId !== channelIds.voiceChannel || !oldState.channelId)
      ) {
        const entry = {
          username: newState.member.user.username,
          userId: newState.member.id,
          action: 'join',
          timestamp: dayjs().tz('Asia/Bangkok').format(),
        };
  
        await this.logEntry(newState, entry);
        this.sendJoinMessage(entry.username);
  
        if (!this.inVoiceChannel.has(newState.member.id)) {
          this.startUserTotalTime(newState);
        }
      }
  
      if (oldState.channelId === channelIds.voiceChannel && !newState.channelId) {
       
        if (this.inVoiceChannel.has(oldState.member.id)) {
          const entry = {
            username: oldState.member.user.username,
            userId: oldState.member.id,
            action: 'leave',
            timestamp: dayjs().tz('Asia/Bangkok').format(),
          };
  
          await this.logLeave(oldState, entry);
          this.sendLeaveMessage(entry.username);
  
          if (!newState || newState.channelId !== channelIds.voiceChannel) {
            this.stopUserTotalTime(oldState);
          }
        }
      }

      if (newState.channelId === channelIds.voiceChannel && oldState.channelId === channelIds.voiceChannel) {
        this.inVoiceChannel.set(newState.member.id, dayjs().tz('Asia/Bangkok').format());
      }
    });
  }
  
  private async logEntry(newState, entry) {
    try {
      const logEntry = new this.logEntryModel(entry).save;
      console.log('User join event saved to MongoDB:', entry);
    } catch (error) {
      console.error('Error saving user join event to MongoDB:', error);
    }
  }
  
  private async logLeave(oldState, entry) {
    try {
      const logLeave = new this.logLeaveModel(entry).save;
      console.log('User leave event saved to MongoDB:', entry);
  
      if (!oldState.channelId || oldState.channelId !== channelIds.voiceChannel) {
        this.stopUserTotalTime(oldState);
      }
    } catch (error) {
      console.error('Error saving user leave event to MongoDB:', error);
    }
  }

  private async stopUserTotalTime(oldState) {
    try {
      const joinTimestamp = this.inVoiceChannel.get(oldState.member.id);
  
      if (joinTimestamp && oldState.channelId === channelIds.voiceChannel) {
        const userTotalTime = await this.userTotalTimeModel.findOne({
          discordId: oldState.member.id,
        });
  
        if (userTotalTime) {
          userTotalTime.totalTime = this.calculateTotalTime(joinTimestamp);
          await userTotalTime.save();
          console.log('User total time tracking stopped:', userTotalTime);
          this.sendTotalTimeMessage(userTotalTime.discordId);
        }
  
        this.inVoiceChannel.delete(oldState.member.id);
      }
    } catch (error) {
      console.error('Error stopping user total time tracking:', error);
    }
  }
 
  private async startUserTotalTime(newState) {
    try {
      const existingUserTotalTime = await this.userTotalTimeModel.findOne({
        discordId: newState.member.id,
      });
  
      if (!this.inVoiceChannel.has(newState.member.id)) {
        this.inVoiceChannel.set(newState.member.id, dayjs().tz('Asia/Bangkok').format());
      }
  
      if (!existingUserTotalTime) {
        const userTotalTime = new this.userTotalTimeModel({
          discordName: newState.member.user.username,
          discordId: newState.member.id,
          totalTimestamp: dayjs().tz('Asia/Bangkok').format(),
        });
  
        await userTotalTime.save();
        console.log('User total time tracking started:', userTotalTime);
      }
    } catch (error) {
      console.error('Error starting user total time tracking:', error);
    }
  }
  
  private calculateTotalTime(startTime) {
    const joinTimestamp = dayjs(startTime);
  
    if (!joinTimestamp.isValid()) {
      console.error('Invalid joinTimestamp:', startTime);
      return {
        hours: '0',
        minutes: '0',
        seconds: '0',
      };
    }
  
    const endTime = dayjs();
    const timeDiff = endTime.diff(joinTimestamp);
    const seconds = Math.floor(timeDiff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
  
    return {
      hours: hours.toString(),
      minutes: (minutes % 60).toString(),
      seconds: (seconds % 60).toString(),
    };
  }
  private sendJoinMessage(username: string) {
    const channel = this.client.guilds.cache.get(serverId).channels.cache.get(channelIds.channelenter) as TextChannelResolvable;
    if (channel) {
      (channel as TextChannel).send(`\`\`\`User ${username} joined the voice channel at ${dayjs().tz('Asia/Bangkok').format()}\`\`\``);
    }
  }

  private sendLeaveMessage(username: string) {
    const channel = this.client.guilds.cache.get(serverId).channels.cache.get(channelIds.channelleave) as TextChannelResolvable;
    if (channel) {
      (channel as TextChannel).send(`\`\`\`User ${username} left the voice channel at ${dayjs().tz('Asia/Bangkok').format()}\`\`\``);
    }
  }

  private async sendTotalTimeMessage(userId: string) {
    try {
      const userTotalTime = await this.userTotalTimeModel.findOne({
        discordId: userId,
      });
  
      if (userTotalTime) {
        const totalTimestamp = dayjs(userTotalTime.timestamp).tz('Asia/Bangkok').format();
        const totalTime = this.calculateTotalTime(userTotalTime.timestamp);
  
        const channelTotalTime = this.client.guilds.cache.get(serverId).channels.cache.get(channelIds.channeltotaltime) as TextChannelResolvable;
  
        if (channelTotalTime) {
          (channelTotalTime as TextChannel).send(`\`\`\`User ${userTotalTime.discordName} spent a total of ${totalTime.hours} hours, ${totalTime.minutes} minutes, and ${totalTime.seconds} seconds in the voice channel until ${totalTimestamp}.\`\`\``);
        }
      }
    } catch (error) {
      console.error('Error sending total time message:', error);
    }
  } 
}
