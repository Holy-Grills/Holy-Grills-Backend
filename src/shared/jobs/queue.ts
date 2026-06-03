import { Queue, type JobsOptions } from "bullmq";
import { getRedisConnectionOptions } from "../redis/redis-client.js";

export const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5000
  },
  removeOnComplete: 500,
  removeOnFail: 1000
};

export function createQueue<DataType = unknown>(name: string): Queue<DataType> {
  return new Queue<DataType>(name, {
    connection: getRedisConnectionOptions(),
    defaultJobOptions
  });
}

