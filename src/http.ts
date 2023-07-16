import { IncomingMessage, ServerResponse } from "http";
import config from "./config.js";
import { ViteRequest, processRequest } from "./proxy.js";

const maxSizeBody = 1000 // 1kb, you do not need more except if you're spamming
export async function handleRequest(req:IncomingMessage, res:ServerResponse<IncomingMessage> & {
    req: IncomingMessage;
}) {
    for(const name in config.headers){
        res.setHeader(name, config.headers[name])
    }

    switch(req.method){
        case "POST": {
            const buffer = await new Promise<Buffer>((resolve, reject) => {
                const chunks:Buffer[] = []
                let length = 0
                req.on("data", chunk => {
                    length += chunk.length
                    if(length > maxSizeBody){
                        reject("Request body too large")
                        return
                    }
                    chunks.push(chunk)
                })
                req.on("end", () => {
                    resolve(Buffer.concat(chunks))
                })
                req.on("error", reject)
            }).catch(err => {
                res.writeHead(400, "Bad Request")
                res.end(JSON.stringify({
                    error: {
                        code: -32002,
                        message: err.message
                    }
                }))
            })
            if(!buffer)return
            let json:ViteRequest | ViteRequest[]
            try{
                json = JSON.parse(buffer.toString("utf-8"))
            }catch(err){
                res.writeHead(400, "Bad Request")
                res.end(JSON.stringify({
                    error: {
                        code: -32002,
                        message: `Invalid JSON: ${err.message}`
                    }
                }))
            }
            if(Array.isArray(json)){
                const response = await Promise.all(json.map(req => {
                    return processRequest(req)
                }))
                res.writeHead(200, "OK", {
                    "Content-Type": "application/json"
                })
                res.end(JSON.stringify(response))
            }else{
                const response = await processRequest(json)
                res.writeHead(200, "OK", {
                    "Content-Type": "application/json"
                })
                res.end(JSON.stringify(response))
            }
            return
        }
        case "GET":
            res.writeHead(200, "OK")
            res.end()
            return
        default:
            res.writeHead(405, "Method Not Allowed")
            res.end()
            return
    }
}