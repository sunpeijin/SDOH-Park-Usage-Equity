# ParkEquity ATX

**An Interactive Explorer of Park Usage and Social Equity Under Public Health Disruptions**

ParkEquity ATX is an interactive research tool for exploring how park use and facility-related equity patterns changed across Austin, Texas, before, during, and after the COVID-19 public health disruption.

The application integrates aggregated smartphone mobility data, park facility information, and population-group-specific statistical results across 237 parks.

## Live Explorer

Explore the interactive application:

https://sunpeijin.github.io/SDOH-Park-Usage-Equity/

## What You Can Explore

### Park Use Explorer

Explore annual park visitation patterns across 237 Austin parks and compare how park use changed across the pre-outbreak, high-intensity pandemic, and adaptation periods.

Interactive filters allow users to examine differences by year, park characteristics, facility availability, and park use patterns.

### Facility Equity Explorer

Explore how 14 types of park facilities are associated with park use among different population groups across 2019–2021.

The explorer presents results from fully adjusted fixed-effects models and allows comparison across population groups, facility types, and years.

Model coefficients represent statistical associations rather than causal effects or individual park equity scores.

## Data and Privacy

The public application uses aggregated and privacy-protected research data.

The Park Use Explorer contains annual park-level summaries for 237 parks. Individual facility quantities are released only as categorical availability levels (`None`, `Low`, `Medium`, and `High`); exact research counts are not included.

The repository does not contain raw mobility records, device-level data, weekly mobility data, origin–destination records, or intermediate research datasets.

## Research

The application translates findings from research on park facility use and social equity into an interactive format for researchers, planners, public health professionals, and other interested users.

The underlying study examines how public health disruptions altered relationships between park facilities and park use among different population groups.

## Citation

If you use this project or its research findings, please cite the associated publication:

**Social equity in park facilities: Assessing park usage patterns from 2019 to 2021 during the COVID-19 pandemic**

https://doi.org/10.1016/j.ufug.2025.129249

## Local Development

Node.js 22 or newer is required.

```bash
npm install
npm run dev
