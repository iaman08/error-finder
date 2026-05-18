import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true, collection: 'users' },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: unknown };

export const UserModel: Model<UserDoc> = model<UserDoc>('User', userSchema);
