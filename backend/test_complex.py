def process(a, b, c, d, e):
    if a:
        if b:
            if c:
                if d:
                    if e:
                        return 1
                    else:
                        return 2
                elif d == 2:
                    return 3
            else:
                return 4
        elif b == 2:
            if c:
                return 5
            else:
                return 6
    else:
        return 0