import { orderBy } from "Expression.js";
import P from "../Predicate.js";
import { querify } from "../Query.js";

test("basic query", async () => {
  const farmers = [
    {
      id: 0,
      name: "Brown",
      partner: {
        name: "Nancy",
      },
      animals: [
        {
          type: "pig",
          weight: 160,
          ageInWeeks: 18,
        },
        {
          type: "cow",
          weight: 300,
          ageInWeeks: 24,
        },
        {
          type: "dog",
          weight: 25,
          ageInWeeks: 7 * 52,
        },
      ],
    },
    {
      id: 1,
      name: "Billy",
      animals: [
        {
          type: "alligator",
          weight: 250,
          ageInWeeks: 10 * 52,
        },
      ],
    },
    {
      id: 2,
      name: "Bob",
      partner: {
        name: "Alice",
      },
      animals: [],
    },
  ];

  type Animal = typeof farmers[0]["animals"][0];

  // Query a collection, filter for "farmer brown", query the sub-collection
  // of his animals, filter for heavy ones.
  // queryAll is async given we allow async filters to be applied.
  // e.g., async lambdas.
  const brownsLargeAnimals = await querify(farmers)
    .where(["name"], P.equals("Brown"))
    // todo: can we make typescript figure this type out for us?
    .query<Animal>(["animals"])
    .where(["weight"], P.greaterThan(30))
    .orderBy(["weight"], "desc")
    .gen();

  console.log(brownsLargeAnimals);
  expect(brownsLargeAnimals).toEqual([
    {
      type: "cow",
      weight: 300,
      ageInWeeks: 24,
    },
    {
      type: "pig",
      weight: 160,
      ageInWeeks: 18,
    },
  ]);

  const alicePartner = await querify(farmers)
    .where(["partner", "name"], P.equals("Alice"))
    .gen();

  console.log(alicePartner);
  expect(alicePartner).toEqual([
    {
      id: 2,
      name: "Bob",
      partner: {
        name: "Alice",
      },
      animals: [],
    },
  ]);

  const allLargeAnimals = await querify(farmers)
    .query<Animal>(["animals"])
    .where(["weight"], P.greaterThan(30))
    .gen();

  console.log(allLargeAnimals);
  expect(allLargeAnimals).toEqual([
    { type: "pig", weight: 160, ageInWeeks: 18 },
    { type: "cow", weight: 300, ageInWeeks: 24 },
    { type: "alligator", weight: 250, ageInWeeks: 520 },
  ]);

  const animalTypes = await querify(farmers)
    .query(["animals"])
    .map((a: { type: string }) => a.type)
    .gen();

  console.log(animalTypes);
  expect(animalTypes).toEqual(["pig", "cow", "dog", "alligator"]);

  // TODO: if we want to return _farmers_ that _have_ large animals
  // we need to port over `whereQueryExists`
  // this looks like:
  /*
  queryAll("farmers")
    .whereQueryExists(q => q.query(["animals"]).where(["weight"], P.greaterThan(30)))
  */
});

// nested collections...
// contains, not contains...
// but also can we treat them like edges and do wheres against their contents?
