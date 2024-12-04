import Fastify, { FastifyReply, FastifyRequest, FastifySchema, RouteHandlerMethod } from "fastify";

export class Router {
    static app = Fastify({logger: true})

    static initialize() {
        this.app.listen({port: 8080, host: "::"}, () => {
            console.log("Server is running on port 8080")
        })
    }
}