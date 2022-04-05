# types galore!

This is my (work in progress) collection of third-party typescript type stubs.

## TODO

1. Finish CLI routing (make updates to mrs-commanderson to facilitate)
2. Write tmpfile project fixture generator
3. Write tests for registry management (with default + config - env var?)
4. Finish installer
  * Pull dependencies from package.json (this is p much working)
  * Query upstream registry URL (default + config) w/ undici + read into data structure
  * For each dependency:
    * Skip if not found
    * Skip if type defs already exist, unless --update flag
    * If found, for each file:
      * Construct the URL from the channel url and the filename
      * curl -o it to the path, mkdirp-ing along the way
