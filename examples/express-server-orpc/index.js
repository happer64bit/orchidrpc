import Express from "express";
import { RPC, handleAllHttp, T } from "@orchidrpc/server";

const app = Express();

// Create an RPC instance, passing `isAuth` into the global context
const rpc = new RPC({
  isAuth: true, // Set the isAuth flag here for global context
});

app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "default-src 'none'; connect-src 'self' http://localhost:4000");
  next();
});

// Define procedures and the router
const appRouter = rpc.router({
  greet: rpc
    .procedure()
    .input(
      T.Object({
        name: T.String(),
      })
    )
    .use(async (opts) => {
      // console.log("HELLO");
      // if(opts.context) {
        return `Hello, ${opts.context.isAuth} ${opts.input.name}`;
      // }
    }),
});

// Set up the HTTP handlers
app.all("/orpc", handleAllHttp(rpc, appRouter));

// Start the server on port 4000
app.listen(4000, () => {
  console.log("Server running on http://localhost:4000");
});
