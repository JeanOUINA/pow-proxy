import Joi from "joi"
import { ViteError } from "web3-vite/dist/errors.js"
import config, { PoWClientType } from "./config.js"
import { difficultyToTarget } from "./pow.js"
import BigNumber from "bignumber.js"


export interface ViteRequest {
    method: string,
    params: any[],
    id: number,
    jsonrpc: "2.0"
}

export const ViteRequestSchema = Joi.object({
    method: Joi.string().required(),
    params: Joi.array().items(Joi.any()).required(),
    id: Joi.number().integer().required(),
    jsonrpc: Joi.string().valid("2.0").required()
}).required()

export const DifficultySchema = Joi.string().pattern(/^\d+$/).required()
export const HashSchema = Joi.string().pattern(/^[0-9a-f]{64}$/).required()
export const ParamsSchema = Joi.array().items(DifficultySchema, HashSchema).required().length(2)

const allowedMethods = new Set<string>([
    "util_getPoWNonce",
    "pow_getPowNonce"
])
export async function processRequest(request:ViteRequest){
    try{
        await ViteRequestSchema.validateAsync(request)
    
        const { method, params } = request
        if(!allowedMethods.has(method)){
            throw new ViteError({error: {code: -32601, message: `The method ${method} does not exist/is not available`}})
        }

        // it's the same api anyway
        await ParamsSchema.validateAsync(params)
        await DifficultySchema.validateAsync(params[0])
        await HashSchema.validateAsync(params[1])
        const [difficulty, hash] = params

        const target = difficultyToTarget(new BigNumber(difficulty))

        // random client
        const client = config.clients[Math.floor(Math.random() * config.clients.length)]
        const { url, type } = client
        
        let body:any
        switch(type){
            case PoWClientType.powclient:
                body = {
                    threshold: target,
                    hash: hash,
                }
                break
            case PoWClientType.powGpu:
                body = {
                    threshold: target,
                    hash: hash,
                    action: "work_generate"
                }
        }

        const start = Date.now()
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        }).catch(err => {
            console.error(err)
            throw new ViteError({error: {code: -32002, message: `An error occured while computing PoW; Server seems unreachable`}})
        })

        const text = await res.text()
        const json = JSON.parse(text)
        if(json.error){
            throw new Error(json.error)
        }
        console.log(`Generated for ${hash} in ${Date.now()-start}ms for threshold ${target}`)

        const work = Buffer.from(
            ({
                [PoWClientType.powclient]: json.data?.work,
                [PoWClientType.powGpu]: json.work
            })[type],
            "hex"
        )
        work.reverse()
        
        return {
            id: request.id,
            jsonrpc: "2.0",
            result: work.toString("base64")
        }
    }catch(err){
        console.error(err)
        return {
            error: {
                code: err instanceof ViteError ? err.code : -32002,
                message: err.message
            },
            id: typeof request === "object" ? request?.id : undefined,
            jsonrpc: "2.0"
        }
    }
}