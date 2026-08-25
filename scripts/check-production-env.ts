import "./load-env";
import { assertProductionEnvironment } from "../lib/env";

assertProductionEnvironment();
console.log("Production environment configuration is valid.");
