import { join } from "path";
import __dirname from "./__dirname.js";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import Joi from "joi";

export interface SSLConfig {
    key: string,
    cert: string
}
export enum PoWClientType {
    powclient = "powclient",
    powGpu = "pow-gpu"
}
export interface PoWClient {
    url: string,
    type: PoWClientType
}
export interface Config {
    clients: PoWClient[],

    port: number,
    host: string,
    ssl?: SSLConfig,

    headers: {
        [key: string]: string
    }
}

export const configPath = join(__dirname, "../config.json")
if(!existsSync(configPath)){
    console.error(`config.json not found at ${configPath}`)
    console.error("Please copy config.example.json to config.json and edit it.")
    process.exit(1)
}

export const config:Config = JSON.parse(await readFile(configPath, "utf-8"))
export default config

export const configSchema = Joi.object({
    clients: Joi.array().items(Joi.object({
        url: Joi.string().uri().pattern(/^https?:\/\//).required(),
        type: Joi.string().valid(...Object.values(PoWClientType)).required()
    })).required().min(1),

    port: Joi.number().integer().min(1).max(65535).required(),
    host: Joi.string().hostname().required(),
    ssl: Joi.object({
        key: Joi.string().required(),
        cert: Joi.string().required()
    }),

    headers: Joi.object().pattern(Joi.string(), Joi.string())
}).required()
export async function validateConfig(config:Config){
    await configSchema.validateAsync(config)
}

try{
    await validateConfig(config)
}catch(err){
    console.error("Invalid config.json:", (err as Error).message)
    process.exit(1)
}