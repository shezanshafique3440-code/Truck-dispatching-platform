import { crawlRules } from "@/lib/site-metadata";
export const dynamic = "force-dynamic";
export default function robots() { return crawlRules(); }
