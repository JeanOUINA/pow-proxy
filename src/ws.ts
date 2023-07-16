import * as WebSocket from "ws";
import { processRequest } from "./proxy.js";

export const wss = new WebSocket.WebSocketServer({ noServer: true })

wss.on("connection", (ws) => {
    ws.on("message", async (message) => {
        try{
            const data = JSON.parse(message.toString("utf8"))
            if(Array.isArray(data)){
                const result = await Promise.all(
                    data.map(req => {
                        return processRequest(req)
                    })
                )
                ws.send(JSON.stringify(result))
            }else{
                const result = await processRequest(data)
                ws.send(JSON.stringify(result))
            }
        }catch(err){
            ws.close(1006, "Invalid request")
        }
    })
})