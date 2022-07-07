import StaticSourceExpression from "./db/StaticSourceExpression.js";
import HopPlan from "./plan/HopPlan.js";
import Plan, { IPlan } from "./plan/Plan.js";
import {
  Expression,
  filter,
  HopExpression,
  map,
  orderByLambda,
  SourceExpression,
  take,
} from "./Expression.js";
import P from "./Predicate.js";
import ObjectFieldHopExpression from "./hop/ObjectFieldHopExpression.js";

type ValueOf<T> = T[keyof T extends number ? keyof T : never];

export abstract class Query<T> {
  // async since we allow application of async filters, maps, etc.
  async gen(): Promise<T[]> {
    const plan = this.plan().optimize();
    let results: T[] = [];
    for await (const chunk of plan.iterable) {
      results = results.concat(chunk);
    }

    return results;
  }

  abstract plan(): IPlan;
}

class SourceQuery<T> extends Query<T> {
  constructor(public readonly expression: SourceExpression<T>) {
    super();
  }

  plan() {
    return new Plan(this.expression, []);
  }
}

class DerivedQuery<TOut> extends Query<TOut> {
  #priorQuery: Query<any>;
  #expression?: Expression;

  constructor(priorQuery: Query<any>, expression?: Expression) {
    super();
    this.#priorQuery = priorQuery;
    this.#expression = expression;
  }

  protected derive<TDerivation>(
    expression: Expression
  ): DerivedQuery<TDerivation> {
    return new DerivedQuery(this, expression);
  }

  query<T>(fn: (x: TOut) => T): DerivedQuery<ValueOf<T>> {
    // ObjectFieldSourceExpression
    // we get the thing along the path
    // turn it into a StaticChunkIterable
    return new DerivedQuery<ValueOf<T>>(ObjectFieldHopQuery.create(this, fn));
  }

  where(fn: (x: TOut) => boolean) {
    return this.derive<TOut>(filter<TOut, TOut>(null, P.lambda(fn)));
  }

  orderBy(fn: (l: TOut, r: TOut) => number) {
    return this.derive<TOut>(orderByLambda(fn));
  }

  take(n: number) {
    return this.derive<TOut>(take(n));
  }

  map<TMapped>(fn: (t: TOut) => TMapped): DerivedQuery<TMapped> {
    return this.derive<TMapped>(map(fn));
  }

  plan() {
    const plan = this.#priorQuery.plan();
    if (this.#expression) {
      plan.addDerivation(this.#expression);
    }

    return plan;
  }
}

export abstract class HopQuery<TIn, TOut> extends Query<TOut> {
  constructor(
    private priorQuery: Query<TIn>,
    public readonly expression: HopExpression<TIn, TOut>
  ) {
    super();
  }

  plan() {
    return new HopPlan(this.priorQuery.plan(), this.expression, []);
  }
}

export function querify<TOut>(collection: Iterable<TOut>): DerivedQuery<TOut> {
  const source = new SourceQuery(new StaticSourceExpression(collection));
  return new DerivedQuery(source);
}

export default class ObjectFieldHopQuery<
  TIn extends Object,
  TOut extends Object
> extends HopQuery<TIn, TOut> {
  static create<TIn extends Object, TOut extends Object>(
    sourceQuery: Query<TIn>,
    fn: (x: TIn) => TOut
  ) {
    return new ObjectFieldHopQuery<TIn, TOut>(
      sourceQuery,
      new ObjectFieldHopExpression(fn)
    );
  }
}
