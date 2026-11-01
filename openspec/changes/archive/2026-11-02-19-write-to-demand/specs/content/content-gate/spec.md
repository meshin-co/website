# content/content-gate Specification

## ADDED Requirements

### Requirement: The next article is chosen from a number

The growth loop SHALL choose the next article from `audits/search-demand.md` before the article is
written, and SHALL record the signal that justified it: a query with impressions and a position
between 8 and 30, a core prompt with no impressions after 90 days, or a query with impressions that
no route answers.

#### Scenario: A query sits one page away

- **WHEN** a query has impressions and an average position between 8 and 30
- **THEN** it is a candidate to strengthen the route that already ranks, not a reason for a new page

#### Scenario: A core prompt has no evidence

- **WHEN** a buyer prompt has produced no impression in 90 days
- **THEN** it is labelled unproven in the report and stays in the core; it is not deleted and not
  presented as a target the site is winning
