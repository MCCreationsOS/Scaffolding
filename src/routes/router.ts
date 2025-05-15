import Fastify from "fastify";
import fastifyMultipart from "@fastify/multipart";
import fastifySSE from "fastify-sse-v2";
import autoload from "@fastify/autoload"
import path from "path"
export class Router {
    static app = Fastify({
        logger: true,
        trustProxy: true  // Trust the proxy
    })

    static async initialize() {

        this.app.register(fastifyMultipart, {
            limits: {
                fileSize: 30 * 1024 * 1024,
            }
        })
        this.app.register(fastifySSE)

        // // Automatically load all routes in the v2 folder
        this.app.register(autoload, {
            dir: path.join(__dirname, "v2"),
            // matchFilter: (path) => path.endsWith("creations.ts"),
            logLevel: "debug"
        })

        await this.app.ready()
        this.app.listen({port: 8080, host: "::"}, () => {
            console.log("Server is running on port 8080")
        })
    }
}
