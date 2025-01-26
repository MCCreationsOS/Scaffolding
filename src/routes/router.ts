import Fastify, { FastifyReply, FastifyRequest, FastifySchema, RouteHandlerMethod } from "fastify";

export class Router {
    static app = Fastify({logger: true})

    static initialize() {
        import('./v2/auth')
        import('./v2/comments')
        import('./v2/creations')
        import('./v2/creators')
        // import('./v2/forum')
        import('./v2/leaderboards')
        // import('./v2/marketplace')
        import('./v2/notifications')
        // import('./v2/report')
        import('./v2/translation')
        import('./v2/user')

        setTimeout(() => {
            this.app.listen({port: 8080, host: "::"}, () => {
                console.log("Server is running on port 8080")
            })
        }, 1000)
    }
}
