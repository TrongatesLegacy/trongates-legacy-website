// Chaplinko's odds: where 100,000 real drops landed for each row count, made by
// scripts/chaplinko-odds.mjs from physics.js (every seed dropped twice, once mirrored). Don't edit by hand: re-run the
// script when the physics changes. check: the first 60 seeds' slots at 10 rows, replayed exactly by the tests.
(() => {
  const K = (window.Chaplinko = window.Chaplinko || {});
  K.odds = {"drops":100000,"counts":{"8":[1430,6444,13760,18174,20384,18174,13760,6444,1430],"9":[806,3622,8776,15549,21247,21247,15549,8776,3622,806],"10":[366,2424,6314,12586,18013,20594,18013,12586,6314,2424,366],"11":[209,1279,4197,9354,15533,19428,19428,15533,9354,4197,1279,209],"12":[251,1072,3485,7394,12242,16362,18388,16362,12242,7394,3485,1072,251]},"check":{"rows":10,"slots":[1,5,8,4,7,5,6,5,4,5,7,4,8,5,7,8,4,4,3,6,3,7,6,5,6,8,3,1,6,5,6,4,4,4,6,5,8,4,3,7,5,8,8,6,5,6,7,4,3,5,2,3,5,8,10,3,4,8,5,4]}};
})();
