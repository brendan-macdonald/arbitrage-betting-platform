"use client";

import React from "react";
import { SPORTS } from "@/lib/oddsAdapters/sports";
import { useRouter, useSearchParams } from "next/navigation";

const ARB_OPTIONS = [
	{ value: "1", label: "True Arbitrage" },
	{ value: "1.01", label: "Near Arbitrage" },
];

const SPORT_DISPLAY_NAMES: Record<string, string> = {
	americanfootball_cfl: "CFL Football",
	americanfootball_ncaaf: "NCAAF Football",
	americanfootball_nfl: "NFL Football",
	aussierules_afl: "Aussie Rules (AFL)",
	baseball_kbo: "KBO Baseball",
	baseball_mlb: "MLB Baseball",
	baseball_npb: "NPB Baseball",
	basketball_nbl: "Basketball (NBL)",
	basketball_wnba: "Basketball (WNBA)",
	boxing_boxing: "Boxing",
	mma_mixed_martial_arts: "MMA",
	cricket_international_t20: "Cricket T20",
	icehockey_liiga: "Ice Hockey (Liiga)",
	icehockey_mestis: "Ice Hockey (Mestis)",
	icehockey_sweden_allsvenskan: "Ice Hockey (Sweden Allsvenskan)",
	icehockey_sweden_hockey_league: "Ice Hockey (Sweden Hockey League)",
	rugbyleague_nrl: "Rugby League (NRL)",
	soccer_argentina_primera_division: "Soccer (Argentina Primera)",
	soccer_austria_bundesliga: "Soccer (Austria Bundesliga)",
	soccer_belgium_first_div: "Soccer (Belgium First Div)",
	soccer_brazil_campeonato: "Soccer (Brazil Campeonato)",
	soccer_brazil_serie_b: "Soccer (Brazil Serie B)",
	soccer_chile_campeonato: "Soccer (Chile Campeonato)",
	soccer_china_superleague: "Soccer (China Superleague)",
	soccer_conmebol_copa_libertadores: "Soccer (Copa Libertadores)",
	soccer_conmebol_copa_sudamericana: "Soccer (Copa Sudamericana)",
	soccer_denmark_superliga: "Soccer (Denmark Superliga)",
	soccer_efl_champ: "Soccer (EFL Champ)",
	soccer_england_efl_cup: "Soccer (England EFL Cup)",
	soccer_england_league1: "Soccer (England League 1)",
	soccer_england_league2: "Soccer (England League 2)",
	soccer_epl: "Soccer (EPL)",
	soccer_fifa_world_cup_qualifiers_europe: "Soccer (World Cup Qualifiers Europe)",
	soccer_finland_veikkausliiga: "Soccer (Finland Veikkausliiga)",
	soccer_france_ligue_one: "Soccer (France Ligue 1)",
	soccer_france_ligue_two: "Soccer (France Ligue 2)",
	soccer_germany_bundesliga: "Soccer (Germany Bundesliga)",
	soccer_germany_bundesliga2: "Soccer (Germany Bundesliga 2)",
	soccer_germany_liga3: "Soccer (Germany Liga 3)",
	soccer_greece_super_league: "Soccer (Greece Super League)",
	soccer_italy_serie_a: "Soccer (Italy Serie A)",
	soccer_italy_serie_b: "Soccer (Italy Serie B)",
	soccer_japan_j_league: "Soccer (Japan J League)",
	soccer_korea_kleague1: "Soccer (Korea K League 1)",
	soccer_league_of_ireland: "Soccer (League of Ireland)",
	soccer_mexico_ligamx: "Soccer (Mexico Liga MX)",
	soccer_netherlands_eredivisie: "Soccer (Netherlands Eredivisie)",
	soccer_norway_eliteserien: "Soccer (Norway Eliteserien)",
	soccer_poland_ekstraklasa: "Soccer (Poland Ekstraklasa)",
	soccer_portugal_primeira_liga: "Soccer (Portugal Primeira Liga)",
	soccer_spain_la_liga: "Soccer (Spain La Liga)",
	soccer_spain_segunda_division: "Soccer (Spain Segunda Division)",
	soccer_spl: "Soccer (SPL)",
	soccer_sweden_allsvenskan: "Soccer (Sweden Allsvenskan)",
	soccer_sweden_superettan: "Soccer (Sweden Superettan)",
	soccer_switzerland_superleague: "Soccer (Switzerland Superleague)",
	soccer_turkey_super_league: "Soccer (Turkey Super League)",
	soccer_uefa_champs_league: "Soccer (UEFA Champions League)",
	soccer_uefa_europa_league: "Soccer (UEFA Europa League)",
	soccer_usa_mls: "Soccer (USA MLS)",
	tennis_wta_china_open: "Tennis (WTA China Open)",
};

const SPORT_OPTIONS = SPORTS.map((sport) => ({
	value: sport, // Odds API key, matches DB
	label: SPORT_DISPLAY_NAMES[sport] || sport, // readable name for UI
}));

export default function Filters() {
	const router = useRouter();
	const sp = useSearchParams();

	const maxSum = sp.get("maxSum") ?? "1";
	const sport = sp.get("sport") ?? "";

	function updateParam(key: string, value: string) {
		const params = new URLSearchParams(sp.toString());
		if (key === "sport" && value === "") {
			params.delete("sport"); // Remove sport param for 'All Sports'
		} else if (value) {
			params.set(key, value);
		} else {
			params.delete(key);
		}
		router.push(`/?${params.toString()}`, { scroll: false });
	}

	return (
		<div className="flex flex-wrap items-center gap-3">
			<label className="text-xs text-muted-foreground">
				Arbitrage Type
				<select
					value={maxSum}
					onChange={(e) => updateParam("maxSum", e.target.value)}
					className="ml-2 rounded-full border bg-white/70 px-3 py-1 text-sm shadow-sm backdrop-blur"
				>
					{ARB_OPTIONS.map((o) => (
						<option key={o.value} value={o.value}>
							{o.label}
						</option>
					))}
				</select>
			</label>

			<label className="text-xs text-muted-foreground">
				Sport
				<select
					value={sport}
					onChange={(e) => updateParam("sport", e.target.value)}
					className="ml-2 rounded-full border bg-white/70 px-3 py-1 text-sm shadow-sm backdrop-blur"
				>
					<option value="">All Sports</option>
					{SPORT_OPTIONS.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
			</label>
		</div>
	);
}
