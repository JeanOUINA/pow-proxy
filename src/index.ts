import "modernlog/patch.js"
import { readFile } from "fs/promises";
import config from "./config.js";
import http from "http";
import https from "https";
import { handleRequest } from "./http.js";
import { wss } from "./ws.js";

const handler = (req, res) => {
    handleRequest(req, res)
    .catch(err => {
        console.error(err)
        res.writeHead(500, "Internal Server Error", {
            "Content-Type": "application/json"
        })
        res.end({
            error: {
                code: -32002,
                message: "Internal Server Error"
            }
        })
    })
}

const server = config.ssl ? https.createServer({
    key: await readFile(config.ssl.key),
    cert: await readFile(config.ssl.cert)
}, handler) : http.createServer(handler)

server.listen(config.port, config.host, () => {
    console.log(`Listening on http${config.ssl ? "s" : ""}://${config.host}:${config.port}/`)
})

server.on("upgrade", (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, ws => {
        wss.emit("connection", ws, req)
    })
})