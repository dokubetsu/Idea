import re
import random
import ast
from datetime import date, timedelta, datetime
from typing import Any
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


def parse_dates_in_dict(d: dict[str, Any]) -> dict[str, Any]:
    res: dict[str, Any] = {}
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


def safe_eval(
    expr: str, eval_globals: dict[str, Any], eval_locals: dict[str, Any]
) -> Any:
    tree = ast.parse(expr, mode="eval")

    def _eval(node: ast.AST) -> Any:
        if isinstance(node, ast.Expression):
            return _eval(node.body)
        elif isinstance(node, ast.Constant):
            return node.value
        elif isinstance(node, ast.Name):
            if node.id in eval_locals:
                return eval_locals[node.id]
            if node.id in eval_globals:
                return eval_globals[node.id]
            raise NameError(f"Name '{node.id}' is not defined or permitted")
        elif isinstance(node, ast.UnaryOp):
            operand = _eval(node.operand)
            if isinstance(node.op, ast.Not):
                return not operand
            elif isinstance(node.op, ast.USub):
                return -operand
            elif isinstance(node.op, ast.UAdd):
                return +operand
            raise TypeError(f"Unsupported unary operator: {type(node.op)}")
        elif isinstance(node, ast.BinOp):
            left = _eval(node.left)
            right = _eval(node.right)
            if isinstance(node.op, ast.Add):
                return left + right
            elif isinstance(node.op, ast.Sub):
                return left - right
            elif isinstance(node.op, ast.Mult):
                return left * right
            elif isinstance(node.op, ast.Div):
                return left / right
            elif isinstance(node.op, ast.Mod):
                return left % right
            elif isinstance(node.op, ast.Pow):
                if not isinstance(left, (int, float)) or not isinstance(
                    right, (int, float)
                ):
                    raise TypeError("Power operator requires numeric operands")
                if abs(right) > 20:
                    raise ValueError(f"Exponent too large: {right}")
                if abs(left) > 1e6:
                    raise ValueError(f"Base too large: {left}")
                result = left**right
                if abs(result) > 1e15:
                    raise ValueError(f"Result too large: {result}")
                return result
            raise TypeError(f"Unsupported binary operator: {type(node.op)}")
        elif isinstance(node, ast.Compare):
            left = _eval(node.left)
            for op, comparator in zip(node.ops, node.comparators):
                right = _eval(comparator)
                if isinstance(op, ast.Eq):
                    if left != right:
                        return False
                elif isinstance(op, ast.NotEq):
                    if left == right:
                        return False
                elif isinstance(op, ast.Lt):
                    if not (left < right):
                        return False
                elif isinstance(op, ast.LtE):
                    if not (left <= right):
                        return False
                elif isinstance(op, ast.Gt):
                    if not (left > right):
                        return False
                elif isinstance(op, ast.GtE):
                    if not (left >= right):
                        return False
                elif isinstance(op, ast.In):
                    if left not in right:
                        return False
                elif isinstance(op, ast.NotIn):
                    if left in right:
                        return False
                else:
                    raise TypeError(f"Unsupported comparison operator: {type(op)}")
                left = right
            return True
        elif isinstance(node, ast.BoolOp):
            if isinstance(node.op, ast.And):
                val = _eval(node.values[0])
                for next_val in node.values[1:]:
                    if not val:
                        return val
                    val = _eval(next_val)
                return val
            elif isinstance(node.op, ast.Or):
                val = _eval(node.values[0])
                for next_val in node.values[1:]:
                    if val:
                        return val
                    val = _eval(next_val)
                return val
            raise TypeError(f"Unsupported boolean operator: {type(node.op)}")
        elif isinstance(node, ast.Attribute):
            value = _eval(node.value)
            if node.attr.startswith("__"):
                raise AttributeError("Access to private attributes is blocked")

            if isinstance(value, (AttrDict, date, datetime, timedelta, relativedelta)):
                try:
                    return getattr(value, node.attr)
                except AttributeError:
                    if isinstance(value, AttrDict) and node.attr in value:
                        return value[node.attr]
                    raise
            raise TypeError(f"Attribute access is not allowed on type {type(value)}")
        elif isinstance(node, ast.Call):
            func_name = None
            if isinstance(node.func, ast.Name):
                func_name = node.func.id
            if func_name not in {"abs", "min", "max", "timedelta", "relativedelta"}:
                raise NameError(f"Function call to '{func_name}' is not allowed")

            func = eval_locals.get(func_name) or eval_globals.get(func_name)
            if not func:
                raise NameError(f"Function '{func_name}' is not defined")

            args = [_eval(arg) for arg in node.args]
            kwargs = {
                kw.arg: _eval(kw.value) for kw in node.keywords if kw.arg is not None
            }
            return func(*args, **kwargs)
        else:
            raise TypeError(f"AST node type {type(node).__name__} is not allowed")

    return _eval(tree)


def topological_sort_facts(facts_def: dict[str, Any]) -> list[str]:
    dependencies: dict[str, set[str]] = {}
    for key, val in facts_def.items():
        deps: set[str] = set()
        if isinstance(val, dict):
            if val.get("type") == "relative_date":
                base = val.get("base", "today")
                if base.startswith("facts."):
                    dep_key = base.split("facts.")[1]
                    deps.add(dep_key)
        dependencies[key] = deps

    visited: dict[str, str] = {}
    order: list[str] = []

    def visit(node: str) -> None:
        if visited.get(node) == "visiting":
            raise ValueError(f"Cycle detected in fact dependencies involving '{node}'")
        if visited.get(node) == "visited":
            return

        visited[node] = "visiting"
        for dep in dependencies.get(node, []):
            if dep in facts_def:
                visit(dep)

        visited[node] = "visited"
        order.append(node)

    for node in facts_def:
        if node not in visited:
            visit(node)

    return order


class FactsGenerator:
    @staticmethod
    def generate(facts_def: dict) -> dict:
        generated: dict[str, Any] = {}
        ordered_keys = topological_sort_facts(facts_def)
        for key in ordered_keys:
            definition = facts_def[key]
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

                base_date: Any = date.today()
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

        rules_dict: dict[str, Any] = {}
        rules_attr = make_attr_dict(rules_dict)

        eval_globals: dict[str, Any] = {"__builtins__": {}}
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
                val = safe_eval(rule_expr, eval_globals, eval_locals)
                rules_dict[rule_name] = val
                rules_attr[rule_name] = val
            except Exception:
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

        eval_globals: dict[str, Any] = {"__builtins__": {}}
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
            return bool(safe_eval(expression, eval_globals, eval_locals))
        except Exception as e:
            raise ValueError(f"Failed to evaluate expression '{expression}': {e}")
