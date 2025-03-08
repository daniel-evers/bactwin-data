import { createReadStream, existsSync, statSync } from 'node:fs'
import http from 'node:http'
import { parse } from 'node:url'
import { join } from 'node:path'
import mime from 'mime'

let server = http.createServer((request, response) => {
    const url = parse(request.url)
    const filepath = join(`${import.meta.dirname}/../compilation`, url.pathname == '/' ? '/index.html' : url.pathname)
    if (!existsSync(filepath)) {
        response.writeHead(404)
        response.end()
        return
    }
    const fileinfo = statSync(filepath)
    if (!fileinfo.isFile()) {
        response.writeHead(403)
        response.end()
        return
    }
    const mimetype = mime.getType(filepath)
    response.setHeader('Content-Length', fileinfo.size)
    response.setHeader('Content-Type', mimetype)
    createReadStream(filepath).pipe(response)
}).listen(0xBAC8, '127.0.0.1')

server.on('listening', () => {
    console.log('Connection:', server.address())
    console.log(`Go to http://localhost:${server.address().port}/`)
})