// Chaplinko's odds: where 100,000 real drops landed for each row count, made by
// scripts/chaplinko-odds.mjs from physics.js (every seed dropped twice, once mirrored). Don't edit by hand: re-run the
// script when the physics changes. check: the first 60 seeds' slots at 10 rows, replayed exactly by the tests.
(() => {
  const K = (window.Chaplinko = window.Chaplinko || {});
  K.odds = {"drops":100000,"counts":{"8":[1596,6640,12611,18800,20706,18800,12611,6640,1596],"9":[343,2993,9029,16331,21304,21304,16331,9029,2993,343],"10":[85,1208,5007,12151,20035,23028,20035,12151,5007,1208,85],"11":[75,623,2734,7829,15854,22885,22885,15854,7829,2734,623,75],"12":[16,318,1589,5339,12023,19347,22736,19347,12023,5339,1589,318,16]},"check":{"rows":10,"slots":[7,4,6,4,6,4,4,5,4,6,5,4,4,4,5,6,4,5,6,4,5,8,3,6,6,5,3,6,8,7,5,3,6,4,4,5,5,7,3,6,7,5,4,7,3,4,3,6,7,2,5,6,1,5,6,2,6,5,4,6]}};
})();
