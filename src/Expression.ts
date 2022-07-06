import { ChunkIterable, TakeChunkIterable } from "./ChunkIterable.js";
import HopPlan from "./plan/HopPlan.js";
import Plan, { IPlan } from "./plan/Plan.js";
import { Predicate } from "./Predicate.js";

export interface FieldGetter<Tm, Tv> {
  readonly get: (Tm) => Tv;
}

export class ObjectFieldGetter<Tm, Tv> implements FieldGetter<Tm, Tv> {
  constructor(public readonly path: string[]) {}

  get(model: Tm): Tv {
    let queriedValue = model;
    for (const key of this.path) {
      queriedValue = queriedValue[key];
    }
    return queriedValue as unknown as Tv;
  }
}

export type Direction = "asc" | "desc";

export type ExpressionType =
  | "take"
  | "filter"
  | "orderBy"
  | "hop"
  | "count"
  | "map";

export type Expression =
  | ReturnType<typeof take>
  | ReturnType<typeof filter>
  | ReturnType<typeof orderBy>
  | ReturnType<typeof count>
  | ReturnType<typeof map>;

export interface SourceExpression<TOut> {
  readonly iterable: ChunkIterable<TOut>;
  optimize(plan: Plan, nextHop?: HopPlan): Plan;
  implicatedDataset(): string;
}

export interface DerivedExpression<TIn, TOut> {
  chainAfter(iterable: ChunkIterable<TIn>): ChunkIterable<TOut>;
  type: ExpressionType;
}

export interface HopExpression<TIn, TOut> {
  chainAfter(iterable: ChunkIterable<TIn>): ChunkIterable<TOut>;
  /**
   * Optimizes the current plan (plan) and folds in the nxet hop (nextHop) if possible.
   */
  optimize(sourcePlan: IPlan, plan: HopPlan, nextHop?: HopPlan): HopPlan;
  implicatedDataset(): string;
  type: "hop";
}

export function take<T>(num: number): {
  type: "take";
  num: number;
} & DerivedExpression<T, T> {
  return {
    type: "take",
    num,
    chainAfter(iterable) {
      return new TakeChunkIterable(iterable, num);
    },
  };
}

export function filter<Tm, Tv>(
  getter: FieldGetter<Tm, Tv> | null,
  predicate: Predicate<Tv>
): {
  type: "filter";
  getter: FieldGetter<Tm, Tv> | null;
  predicate: Predicate<Tv>;
} & DerivedExpression<Tm, Tm> {
  return {
    type: "filter",
    getter,
    predicate,
    chainAfter(iterable) {
      return iterable.filter((m) =>
        // TODO:
        // @ts-ignore
        predicate.call(getter == null ? m : getter.get(m))
      );
    },
  };
}

export function map<T, R>(
  fn: (f: T) => R
): { type: "map" } & DerivedExpression<T, R> {
  return {
    type: "map",
    chainAfter(iterable) {
      return iterable.map(fn);
    },
  };
}

export function orderBy<Tm, Tv>(
  getter: FieldGetter<Tm, Tv>,
  direction: Direction
): {
  type: "orderBy";
  getter: FieldGetter<Tm, Tv>;
  direction: Direction;
} & DerivedExpression<Tm, Tm> {
  return {
    type: "orderBy",
    getter,
    direction,
    chainAfter(iterable) {
      return iterable.orderBy((leftModel: Tm, rightModel: Tm) => {
        const leftValue = getter.get(leftModel);
        const rightValue = getter.get(rightModel);

        if (leftValue == rightValue) {
          return 0;
        }

        if (leftValue > rightValue) {
          return direction === "asc" ? 1 : -1;
        }
        return direction === "asc" ? -1 : 1;
      });
    },
  };
}

export function count<Tm>(): { type: "count" } & DerivedExpression<Tm, number> {
  return {
    type: "count",
    chainAfter(iterable) {
      return iterable.count();
    },
  };
}