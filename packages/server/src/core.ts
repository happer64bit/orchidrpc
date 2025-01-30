import { IncomingMessage, ServerResponse } from 'http';
import type { Static, TSchema as TTypeBoxSchema } from '@sinclair/typebox'; // Importing Static for type inference
import { Check } from '@sinclair/typebox/value';

/**
 * Type to represent the context passed to the procedures, now a function returning dynamic values.
 * @typedef {function(IncomingMessage, ServerResponse): Record<string, any>} RPCContext
 */
export type RPCContext = (request: IncomingMessage, response: ServerResponse) => Record<string, any>;

/**
 * Represents the options available in each procedure, including input, context, request, and response.
 * @template TInput - The type of the input for the procedure.
 */
export interface ProcedureOptions<TInput> {
  /**
   * Input data for the procedure.
   */
  input: TInput;

  /**
   * The merged context from global and request-specific sources.
   */
  context: Record<string, any>;

  /**
   * Incoming HTTP request.
   */
  request: IncomingMessage;

  /**
   * HTTP response to be sent.
   */
  response: ServerResponse;
}

/**
 * A builder for creating a procedure within the given context.
 * @template TContext - The context type for the procedure.
 */
export interface ProcedureBuilder<TContext extends RPCContext> {
  /**
   * Adds input validation to the procedure and returns a procedure with input handling.
   * @template TSchema - The schema for the input data.
   * @param {TSchema} schema - A TypeBox schema for validating the input.
   * @returns {ProcedureWithInput<TContext, Static<TSchema>>} - A procedure that accepts input data with validation.
   */
  input<TSchema extends TTypeBoxSchema>(schema: TSchema): ProcedureWithInput<TContext, Static<TSchema>>;

  /**
   * Adds a global middleware to the procedure.
   * @template TResult - The return type of the handler function.
   * @param {function(ProcedureOptions<never>, () => Promise<TResult>): TResult | Promise<TResult>} handler - The middleware handler.
   * @returns {Procedure<TContext, never, TResult>} - A procedure with global middleware.
   */
  use<TResult>(
    handler: (opts: ProcedureOptions<never>, next: () => Promise<TResult>) => TResult | Promise<TResult>
  ): Procedure<TContext, never, TResult>;
}

/**
 * A procedure that includes input validation and the ability to add middleware.
 * @template TContext - The context type for the procedure.
 * @template TInput - The type of input data that the procedure accepts.
 */
export interface ProcedureWithInput<TContext extends RPCContext, TInput> {
  /**
   * Adds middleware to the procedure.
   * @template TResult - The return type of the handler function.
   * @param {function(ProcedureOptions<TInput>, () => Promise<TResult>): TResult | Promise<TResult>} handler - Middleware function.
   * @returns {Procedure<TContext, TInput, TResult>} - A procedure with input validation and middleware.
   */
  use<TResult>(
    handler: (opts: ProcedureOptions<TInput>, next: () => Promise<TResult>) => TResult | Promise<TResult>
  ): Procedure<TContext, TInput, TResult>;
}

/**
 * The main interface for defining a procedure with input validation, a handler, and middleware.
 * @template TContext - The context type for the procedure.
 * @template TInput - The type of input data the procedure accepts.
 * @template TResult - The result type the procedure returns.
 */
export interface Procedure<TContext extends RPCContext, TInput, TResult> {
  /**
   * Optional input validation function.
   */
  validateInput?: (input: unknown) => TInput;

  /**
   * Main handler function for the procedure.
   * @param {ProcedureOptions<TInput>} opts - Options including input, context, request, and response.
   * @returns {TResult | Promise<TResult>} - The result of the procedure.
   */
  handler: (opts: ProcedureOptions<TInput>) => TResult | Promise<TResult>;

  /**
   * Middleware chain for the procedure.
   */
  middleware: Array<(opts: ProcedureOptions<TInput>, next: () => Promise<TResult>) => TResult | Promise<TResult>>;
}

/**
 * The main class for managing RPC procedures and middleware.
 */
export class RPC {
  /**
   * Global context shared across all procedures.
   */
  private globalContext: Record<string, any>;

  /**
   * Global middleware array.
   */
  private middleware: Array<(opts: any, next: () => Promise<any>) => any> = [];

  /**
   * Creates a new RPC instance with the global context.
   * @param {Record<string, any>} globalContext - An optional static global context to be used across all procedures.
   */
  constructor(globalContext: Record<string, any> = {}) {
    this.globalContext = globalContext;
  }

  /**
   * Merges global context with request-specific context.
   * @param {IncomingMessage} request - The HTTP request.
   * @param {ServerResponse} response - The HTTP response.
   * @param {RPCContext} contextFn - The context function for the procedure.
   * @returns {Record<string, any>} - The merged context.
   */
  private mergeContexts(request: IncomingMessage, response: ServerResponse, contextFn: RPCContext): Record<string, any> {
    let requestContext = {};

    if (typeof contextFn === 'function') {
      requestContext = contextFn(request, response) || {}; // Default to empty object if undefined
    }

    // Merge the global context with the request-specific context
    return { ...this.globalContext, ...requestContext };
  }

  /**
   * Builds a procedure with input validation and middleware.
   * @returns {ProcedureBuilder<RPCContext>} - An object that allows you to define a procedure.
   */
  procedure(contextFn: RPCContext): ProcedureBuilder<RPCContext> {
    return {
      input: <TSchema extends TTypeBoxSchema>(schema: TSchema) => {
        const validateInput = (input: unknown): Static<TSchema> => {
          const result = Check(schema, input);
          if (!result) {
            throw new Error(`Validation failed for schema: ${JSON.stringify(schema)}`);
          }
          return input as Static<TSchema>;
        };

        return {
          use: <TResult>(
            handler: (opts: ProcedureOptions<Static<TSchema>>, next: () => Promise<TResult>) => TResult | Promise<TResult>
          ) => {
            const procedure: Procedure<RPCContext, Static<TSchema>, TResult> = {
              validateInput,
              handler: (opts: ProcedureOptions<Static<TSchema>>) => handler(opts, async () => Promise.resolve() as TResult),
              middleware: [],
            };
            return procedure;
          },
        };
      },

      use: <TResult>(
        handler: (opts: ProcedureOptions<never>, next: () => Promise<TResult>) => TResult | Promise<TResult>
      ): Procedure<RPCContext, never, TResult> => {
        const procedure: Procedure<RPCContext, never, TResult> = {
          handler: (opts: ProcedureOptions<never>) => handler(opts, async () => Promise.resolve() as TResult),
          middleware: [],
        };
        return procedure;
      },
    };
  }

  /**
   * Executes a procedure with the given input and HTTP request/response.
   * @template TInput
   * @template TResult
   * @template TProcedure
   * @param {TProcedure} procedure - The procedure to execute.
   * @param {unknown} input - The raw input to validate and process.
   * @param {IncomingMessage} request - The incoming HTTP request.
   * @param {ServerResponse} response - The outgoing HTTP response.
   * @returns {Promise<TResult>} - The result of the procedure execution.
   */
  async execute<TInput, TResult, TProcedure extends Procedure<any, TInput, TResult>>(
    procedure: TProcedure,
    input: unknown,
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<TResult | void> {
    let validatedInput: TInput;

    try {
      validatedInput = procedure.validateInput ? procedure.validateInput(input) : (input as TInput);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.sendErrorResponse(response, 400, 'Invalid input', errorMessage);
      return;
    }

    const context = this.mergeContexts(request, response, () => this.globalContext); // Context declared

    let index = 0;

    const next = async (): Promise<TResult> => {
      if (index < procedure.middleware.length) {
        const middlewareFn = procedure.middleware[index++];
        return middlewareFn({ input: validatedInput, context, request, response }, next);
      }
      return procedure.handler({ input: validatedInput, context, request, response }); // Handler invoked properly
    };

    try {
      return await next();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.sendErrorResponse(response, 500, 'Internal server error', errorMessage);
      throw error;
    }
  }


  /**
   * Sends a standardized error response to the client.
   * @param response - The HTTP response object.
   * @param statusCode - The HTTP status code for the error.
   * @param message - The error message.
   * @param details - Additional error details.
   */
  private sendErrorResponse(response: ServerResponse, statusCode: number, message: string, details?: string) {
    response.statusCode = statusCode;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ error: message, details }));
  }

  /**
   * Return the procedures as a router.
   * @param procedures - The procedures to be used.
   * @returns {Record<string, Procedure<any, any, any>>}
   */
  router(procedures: Record<string, Procedure<any, any, any>>) {
    return procedures;  // Return the procedures as a router
  }
}
