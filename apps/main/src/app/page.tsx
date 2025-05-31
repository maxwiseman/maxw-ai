import { Button } from "@acme/ui/button";
import { Card, CardHeader, CardTitle } from "@acme/ui/card";

export default function Page() {
  return (
    <div>
      <Button>Hello</Button>
      Hello, world!
      <Card>
        <CardHeader>
          <CardTitle>Hello</CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
