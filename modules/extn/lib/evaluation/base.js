import s from "@babel/parser";
import l from "@babel/traverse";
class p {
  __analyze__(e) {
    var r;
    return (r = this.analyze) == null ? void 0 : r.call(this, e);
  }
  parse(e) {
    var a;
    const r = s.parse(e, {
      tokens: !0
    });
    if (!r) throw new Error("Parse failed");
    (a = r.errors) == null || a.forEach(console.error);
    let o;
    return l(r.program, {
      Program: (t) => (o = t, void t.stop())
    }), o;
  }
}
export {
  p as Evaluation
};
