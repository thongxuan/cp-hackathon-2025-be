import mongoose from "mongoose";

export const withTransaction = async (
  fn: (session: mongoose.ClientSession) => Promise<any>,
  existingSession?: mongoose.ClientSession | null,
) => {
  if (existingSession) {
    if (existingSession.inTransaction()) {
      await fn(existingSession);

      return;
    }

    await existingSession.withTransaction(fn);

    return;
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(fn);
  } finally {
    await session.endSession();
  }
};
