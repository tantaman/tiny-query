import { Paths } from "../paths.js";
import { ChunkIterable } from "../ChunkIterable.js";
import { HopExpression } from "../Expression.js";
import HopPlan from "../plan/HopPlan.js";
import { IPlan } from "../plan/Plan.js";
import ObjectFieldHopChunkIterable from "./ObjectFieldHopChunkIterable.js";

export default class ObjectFieldHopExpression<
  TIn extends Object,
  TOut extends Object
> implements HopExpression<TIn, TOut>
{
  constructor(public readonly path: Paths<TIn>) {}

  chainAfter(iterable: ChunkIterable<TIn>): ChunkIterable<TOut> {
    return new ObjectFieldHopChunkIterable(iterable, this.path);
  }

  optimize(sourcePlan: IPlan, plan: HopPlan, nextHop?: HopPlan): HopPlan {
    let derivs = [...plan.derivations];
    if (nextHop) {
      derivs.push(nextHop.hop);
      derivs = derivs.concat(nextHop.derivations);
    }
    return new HopPlan(
      sourcePlan,
      new ObjectFieldHopExpression(this.path),
      derivs
    );
  }

  type: "hop" = "hop";

  implicatedDataset(): string | null {
    return null;
  }
}
