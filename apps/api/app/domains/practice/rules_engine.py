import re
import random
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class AttrDict(dict):
    def __getattr__(self, name):
        if name in self:
            return self[name]
        raise AttributeError(f"No such attribute: {name}")

    def __setattr__(self, name, value):
        self[name] = value


def make_attr_dict(d: dict) -> AttrDict:
    res = AttrDict()
    for k, v in d.items():
        if isinstance(v, dict):
            res[k] = make_attr_dict(v)
        else:
            res[k] = v
    return res


def parse_dates_in_dict(d: dict) -> dict:
    res = {}
    for k, v in d.items():
        if isinstance(v, dict):
            res[k] = parse_dates_in_dict(v)
        elif isinstance(v, str) and DATE_RE.match(v):
            try:
                res[k] = date.fromisoformat(v)
            except ValueError:
                res[k] = v
        else:
            res[k] = v
    return res


class FactsGenerator:
    @staticmethod
    def generate(facts_def: dict) -> dict:
        generated = {}
        for key, definition in facts_def.items():
            if definition.get("player_input"):
                continue

            f_type = definition.get("type")
            if f_type == "pool":
                values = definition.get("values", [])
                generated[key] = random.choice(values)
            elif f_type == "range":
                f_min = definition.get("min", 0)
                f_max = definition.get("max", 0)
                step = definition.get("step", 1)
                generated[key] = random.choice(list(range(f_min, f_max + 1, step)))
            elif f_type == "relative_date":
                base = definition.get("base", "today")
                offset_days = definition.get("offset_days", 0)

                if base == "today":
                    base_date = date.today()
                elif base.startswith("facts."):
                    base_key = base.split("facts.")[1]
                    base_val = generated.get(base_key)
                    if isinstance(base_val, str):
                        base_date = date.fromisoformat(base_val)
                    else:
                        base_date = base_val
                else:
                    base_date = date.today()

                res_date = base_date + timedelta(days=offset_days)
                generated[key] = res_date.isoformat()
        return generated


class RulesEngine:
    @staticmethod
    def evaluate_rules(rules_def: dict, facts: dict, player_input: dict) -> dict:
        parsed_facts = parse_dates_in_dict(facts)
        parsed_input = parse_dates_in_dict(player_input)

        facts_attr = make_attr_dict(parsed_facts)
        input_attr = make_attr_dict(parsed_input)

        rules_dict = {}
        rules_attr = make_attr_dict(rules_dict)

        eval_globals = {"__builtins__": {}}
        eval_locals = {
            "facts": facts_attr,
            "input": input_attr,
            "rules": rules_attr,
            "timedelta": timedelta,
            "relativedelta": relativedelta,
            "abs": abs,
            "min": min,
            "max": max,
        }

        for rule_name, rule_expr in rules_def.items():
            try:
                val = eval(rule_expr, eval_globals, eval_locals)
                rules_dict[rule_name] = val
                rules_attr[rule_name] = val
            except Exception:
                # Skip rules that cannot be evaluated yet (e.g. referencing uncollected player inputs)
                pass

        return rules_dict

    @staticmethod
    def evaluate_condition(
        expression: str, facts: dict, player_input: dict, rules: dict
    ) -> bool:
        parsed_facts = parse_dates_in_dict(facts)
        parsed_input = parse_dates_in_dict(player_input)
        parsed_rules = parse_dates_in_dict(rules)

        facts_attr = make_attr_dict(parsed_facts)
        input_attr = make_attr_dict(parsed_input)
        rules_attr = make_attr_dict(parsed_rules)

        eval_globals = {"__builtins__": {}}
        eval_locals = {
            "facts": facts_attr,
            "input": input_attr,
            "rules": rules_attr,
            "timedelta": timedelta,
            "relativedelta": relativedelta,
            "abs": abs,
            "min": min,
            "max": max,
        }

        try:
            return bool(eval(expression, eval_globals, eval_locals))
        except Exception as e:
            raise ValueError(
                f"Failed to evaluate expression '{expression}': {e}"
            )
