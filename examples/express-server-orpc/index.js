import Express from 'express'
import { RPC, handleAllHttp } from '@orchidrpc/server'

const app = Express();

const rpc = new RPC();

const appRouter = rpc.router({
    greet: rpc.procedure()
        .input((input) => {
            if (typeof input.name !== "string") throw new Error("Invalid name");
            return input;
        })
        .use(async (opts) => `Hello, ${opts.input.name}!`),
    
    add: rpc.procedure()
        .input((input) => {
            if (typeof input.a !== "number" || typeof input.b !== "number") {
                throw new Error("Inputs a and b must be numbers");
            }
            return input;
        })
        .use(async (opts) => opts.input.a + opts.input.b),
});

app.all("/orpc", handleAllHttp(rpc, appRouter))

app.listen(4000)