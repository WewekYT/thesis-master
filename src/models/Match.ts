import mongoose, { Schema, Document, Model } from "mongoose";

interface Goal {
  minute: string;
  name: string;
  surname: string;
  additional: string;
}

interface TeamInfo {
  score: number;
  goals: Goal[];
}

export interface MatchDocument extends Document {
  id: number;
  time: Date;
  tv: string;
  state: "completed" | "live" | "finished";
  team1: string;
  team2: string;
  stadium: string;
  teaminfo1: TeamInfo;
  teaminfo2: TeamInfo;
}

const GoalSchema: Schema = new Schema<Goal>({
  minute: String,
  name: String,
  surname: String,
  additional: String,
});

const TeamInfoSchema: Schema = new Schema<TeamInfo>({
  score: Number,
  goals: [GoalSchema],
});

const MatchSchema: Schema = new Schema<MatchDocument>({
  id: { type: Number, required: true },
  time: { type: Date, required: true },
  tv: { type: String, required: true },
  state: { type: String, enum: ["completed", "live", "finished"], required: true },
  team1: { type: String, required: true },
  team2: { type: String, required: true },
  stadium: { type: String, required: true },
  teaminfo1: { type: TeamInfoSchema, required: true },
  teaminfo2: { type: TeamInfoSchema, required: true },
});

export const Match: Model<MatchDocument> = mongoose.models.Match || mongoose.model<MatchDocument>("Match", MatchSchema);
export default Match;
