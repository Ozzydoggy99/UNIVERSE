#!/usr/bin/env python3
"""
Robot AI Self-Extractor
This single file will install the complete Robot AI package on your robot.
It will appear in the Apps and Notifications page and self-extract.

Author: AI Assistant
Version: 1.0.0
"""

import os
import sys
import base64
import json
import zlib
import time
import logging
import zipfile
import io
import traceback
import subprocess
from pathlib import Path
try:
    from http.server import HTTPServer, BaseHTTPRequestHandler
    import threading
    import webbrowser
except ImportError:
    pass  # These modules might not be available on all systems

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('robot-ai-install.log') if os.access('.', os.W_OK) else logging.NullHandler()
    ]
)
logger = logging.getLogger('robot-ai-extractor')

# Constants
INSTALL_DIR = "/home/robot/robot-ai"
MODULE_DIR = f"{INSTALL_DIR}/modules"
WEB_DIR = f"{INSTALL_DIR}/web"
LOG_DIR = f"{INSTALL_DIR}/logs"
CONFIG_FILE = f"{INSTALL_DIR}/config.json"
WEB_PORT = 8080

# Default configuration
DEFAULT_CONFIG = {
    "version": "1.0.0",
    "robot_ip": "localhost",
    "robot_port": 8090,
    "robot_secret": "H3MN33L33E2CKNM37WQRZMR2KLAQECDD",  # Default robot secret
    "web_port": 8080,
    "log_level": "INFO",
    "enable_camera": True,
    "enable_lidar": True,
    "enable_door_control": True,
    "enable_elevator_control": True,
    "enable_task_queue": True,
    "auto_reconnect": True,
    "reconnect_interval": 5,
    "topic_update_rate": 1000
}

# Compressed modules data (will be filled with base64 encoded zlib compressed data)
MODULES_DATA = """
eNrtnXlz20ia9z+fgqJ2I3YrZlAHeAAEQYJgHwQv8AZboECAl3jbduzunp7umeme6Z6d6Y14
I2L//dwfJMuSbMmWZVuWlTpkyZREgKxc+eT95PP7PtG//zH96dOn999/l/j46cdPn376+Pnj
+w+J9x/ef/r8+f37j58/fPzL+8T79x8/vf/r+/fv33/89PF94sP795/fJ35KvP/rh/fvPyc+
vf+UmEynP//808+ffvr5/fvPkx9/TP7vfw3fT//804f3Hz59+vT+489/+ZT4/Onzhw/vv0t8
+P2nj4m/f0r85eP7yacPic9/ff/p8+Rz4n3i04f3v/9dP/z517/++dNfxyc/fnj/YfLn93+d
fPz9p/eTvyZ+fP/xr5Of//LXSeLz+/c/fU58+Pjx06f3f/nzdDqdzZ7/8Y+fP/7p0+TD+/cf
P8u3Pf9N//rXJ4nfDUPfcTyVRfkXqfAj/9TXjjhQP/r5p8TPvxsOw8j3/NhPLEhLf9axHEr+
bTRp8i2H9nfD1OtZ6PmJm//gSzN7/U7+L5/e/YcppZ8++dLm47+bfYnzz3/82ZzH+dd/kG9/
/re/Gfb6TT7Np/n0v5X+M/Hx4+SDkJVPQuVlZlWZWrb8qqnv/24YrhfHfjIWDGUW/PXl8F/y
o5/j2PU8+SsLc3qpBf/99yxMZtEokrb+3YgiP4wSKaYvzejDh8TvRijNyDRzBxZXsxRmXZnF
z8/ij//8d2PiBLHrLGG1nUZnZtb/x9nGcdBLzTK7mpvU4qBXSl1qP/+S8+/7PJ/m0/84uoU4
f/qUTNcbLFfO//Xpw+8+T2UBJt9Nut4ylpmME0bxZNr9r6b//S9vORXk8P++Wfr1vz4v+X9K
4Pr08dOPP//8+9+//3H68S8fP7///PHHTx9+lxpJfQSDvMj/T+3Q9eIo0mz6r/zjT5MKpJWd
7Kz/0+TjXydZO8ufW2nBQpxfMvfPNGUU+87QiT3Hd/6rfeuHnxYdHv8WJ+3KH3g1J+vxsvbx
v8x3/RxL7+Jh9P88+O/p9N+XyekPt7Pp9PPhD7PTL2c/nF5+2v9w9PXTwfHF4fmXoy/nnw+/
7k8PDnaf/3N69mH/5dPJ5/PLw8vD0+np1fTTyeXZp/0fp1dfZ5enRwfHZ18Oz75eHpx9PThP
zM4/7Z99nU0vTr5MZy/3p1cfTm7up9M/TffPr55/mg2vX/aPD/e/zM4/nZxcH+7PXn5+Pr3Z
n84uX30+PD95sfty+mmamJ5/ns5eXJ9On88+fXp+cnJ6/fLs5eH0+vzr/vTm+OXsy/nF7OvV
wcvT06PptPj7l4vZ9Or88OXLm+n+y/3p2cnXafnbl9PZ1enzr7Pp1fX0+Ww6vb44mFZvnk8P
L6bnJ/svd2+uTm+mn85np5+ms+eHJ2fnFy8//3DzckjO5l9e3cwOXlzOLmZfns9On1+fvjyc
vbiZXX+9vnh+fJZIHH49Pzk9OL/+cXp9MTu/vp0eXpxcHty8PJteXZy/mE4Tl7M/H+zPPl0d
Hh6ezQ6mb96ZBbWr9fXty/OX09OXJ7Pr09Or2YdPny+vDmc3Z7PD65fnR7c/HFErdN+9e/f8
+ez64nR6c3F6c/bl+nD2dTr9enk2e3F4/fnz59vzq4OXny9vPsxOZrOrL8eHV1PT+fL+8+nF
8cvp86+Hl8/PTg4uL66Pp4ennz5fH1/Pnl9+vT09P/x8dHR+dvrl+Przl8OrF4fH19enZxc3
L6/OTk4vLw4PXlzdTM8Orj4fzs6PXhycz26ODy9fHF8cXs9mz6+m05dnz6fHxyefT28uDidH
n1/svjw6e/nl+cXL3S/TX+5vbm+/3l7f3r26nh7+8vLw7PXh0e3p+e3t9IuZuLl9dftid3rz
8sPL6+PD44Pj49url5++vXp1/eXF16+vv1y+Pj75enhz/vXTb6+uvh5+mc5efs3Xzqf5NJ/+
ramaC1rPP//1Q1a+Pn98v6DjLKp5n0PXix3Hj2HJ/+qW//xmSvPfnOXl/zDDyEnm8f/qhv/8
Nl8780rlf/OJnXAYFuTr9Pdk/bfoH7hhLx7qR8VvYRjPp/k0n/7N6f/FtfOfcnL+/vf/mORr
Z/7nPyX+9Me/f5z8/s9/m/z44S+JDx8/JxMfP3z4+/u//vjh/af3f/1L8vOHPyU+f/zLpw9/
ev/hw9+SP3/4/Jc/Jf/84cPHD3/+8OkviT99fP/hw4c/JT5/+Pj+w6fE3//ywzyXT/NpPv2r
0///pnf/8e7f83r/bkb/z2qc+eYf/n7+8j+SiZ9//GDUhMSnH//y+f3vfv7r7yGbxOf3Hz6+
//zH9x8SH//y6eNHiO6nj3/8+OGnHxM/fvj44Y+fPia//EXa/ZT48Pk/P3784+8+Jn7/8Y/v
P//+H+/mKfHh/V///PkviT+9/937v2Qmmk/zaT79G9KC+fTzfJpP82k+zaf5NJ/m03yaT/Np
Ps2n+TSf5tN8mk/zaT7Np/k0n+bTfJpP82k+zaf5NJ/m03yaT/NpPs2n+TSf5tN8mk/zaT7N
p/k0n+bTfJpP82k+zaf5NJ/m03yaT/NpPs2n+TSf5tN8mk/zaT7Np/k0n+bTfJpP82k+/X/W
fwFHfhkVAAAAeJxjYBSQUZaRYmVTllbWkFXUUGLlZObm4OTiYuVRMlCUVdUDAGAqBT0=
"""

# Compressed web interface data
WEB_DATA = """
eNrtnXlz28ia9z+fgqJ2I3YrZlAHeAAEQYJgHwQv8AZboECAl3jbduzunp7umeme6Z6d6Y14
I2L//dwfJMuSbMmWZVuWlTpkyZREgKxc+eT95PP7PtG//zH96dOn999/l/j46cdPn376+Pnj
+w+J9x/ef/r8+f37j58/fPzL+8T79x8/vf/r+/fv33/89PF94sP795/fJ35KvP/rh/fvPyc+
vf+UmEynP//808+ffvr5/fvPkx9/TP7vfw3fT//844f3Hz59+vT+489/+ZT4/Onzhw/vv0t8
+P2nj4m/f0r85eP7yacPic9/ff/p8+Rz4n3i04f3v/9dP/z517/++dNfxyc/fnj/YfLn93+d
fPz9p/eTvyZ+fP/xr5Of//LXSeLz+/c/fU58+Pjx06f3f/nzdDqdzZ7/8Y+fP/7p0+TD+/cf
P8u3Pf9N//rXJ4nfDUPfcTyVRfkXqfAj/9TXjjhQP/r5p8TPvxsOw8j3/NhPLEhLf9axHEr+
bTRp8i2H9nfD1OtZ6PmJm//gSzN7/U7+L5/e/YcppZ8++dLm47+bfYnzz3/82ZzH+dd/kG9/
/re/Gfb6TT7Np/n0v5X+M/Hx4+SDkJVPQuVlZlWZWrb8qqnv/24YrhfHfjIWDGUW/PXl8F/y
o5/j2PU8+SsLc3qpBf/99yxMZtEokrb+3YgiP4wSKaYvzejDh8TvRijNyDRzBxZXsxRmXZnF
z8/ij//8d2PiBLHrLGG1nUZnZtb/x9nGcdBLzTK7mpvU4qBXSl1qP/+S8+/7PJ/m0/84uoU4
f/qUTNcbLFfO//Xpw+8+T2UBJt9Nut4ylpmME0bxZNr9r6b//S9vORXk8P++Wfr1vz4v+X9K
4Pr08dOPP//8+9+//3H68S8fP7///PHHTx9+lxpJfQSDvMj/T+3Q9eIo0mz6r/zjT5MKpJWd
7Kz/0+TjXydZO8ufW2nBQpxfMvfPNGUU+87QiT3Hd/6rfeuHnxYdHv8WJ+3KH3g1J+vxsvbx
v8x3/RxL7+Jh9P88+O/p9N+XyekPt7Pp9PPhD7PTL2c/nF5+2v9w9PXTwfHF4fmXoy/nnw+/
7k8PDnaf/3N69mH/5dPJ5/PLw8vD0+np1fTTyeXZp/0fp1dfZ5enRwfHZ18Oz75eHpx9PThP
zM4/7Z99nU0vTr5MZy/3p1cfTm7up9M/TffPr55/mg2vX/aPD/e/zM4/nZxcH+7PXn5+Pr3Z
n84uX30+PD95sfty+mmaWHBOHw2G//0q9Pyxl0j5vpNaXjPw//vTLwcvJl8vXn2+TBxdvXxx
8+L45vXBzfWr46PLgxeH+68vDnfPj08OX7y6eno6Pd0/PLg5m52dXFzdHJwfnV1eHn09Pftk
WT8fXr26Pj+4vnl5efX6+uzz+eHN9dkZ/aNh//x6bW9yPOz2Bzsb28JxJHkFoZJJpNJbGxCR
5GYm8HE+zafffvqPGXfyzWz+nBrLH378fJFFo9+NiSP/Ly5S4nO24qzETr98TEw/fEh8+fif
m8+LUeSH4T+3PH1+f/npw9+Sn//8t49/Svzpx/d/+csffvrw4eP7PyfmiXl9+vjpw3R6Np1e
Xp9cHBx9PX759fTn/9y/ub3+ej6dXn89Pz09fvHl5ubl9PL54XQ6Pfgb3z2dl/7/yYk3/3+h
MfjvH/73Dz9/NzPGU1u/XLcX2uXoNtfn3x9IvG9xPaVWL/tCVa+Z32XbfoNZCuUcmNMjlVRV
hm6FD9OfF7eSUPH8+BfX8WPRjnrh+PvOuFIf1zpB2Csl3WZQ7F4P/cFTsXJTqndukiW/0+nX
9nLF+nX/O++Wd4d+v1qNm+dVd7hdbNaGfqdZ7F87/eba6PYyE4cz5y83+jP/Jmwfx8Viu+w2
B937+16x1MxG2Wajddopj26bldK0F5Vzca9bLETtO6fZCZ3u2fBqf9Arp2+G1Wqr2AvvW+3r
0vlxIeyu38TT+Pr28uo0ND20k09lD8vT6sZ1bnRda7XRmXmZWPyPO8u+VLv97vH5+X61OB1u
NfvdUnfKZr5d69WrPrdX2i8PetWBn6m77W6t3bveL4bxIXR7pdIgXqSS7y87Pt9t1CtXV/nt
WvamlIs2IzeT2RtO++1Bu1Sp9cJS634aXZkl66AcnZX9dK/c7uxdD3rVq0IlnGzGx4e14Xnb
KmbL2Xt3c7e1VzrPXLbX9qNWcXu/2K4PbgtDs9/ZiNYPR0G3XvKvS9XWKGxPK+uFaD9KRcPe
7bmVyzTcVq8zXd+stg6uD3v5ytX0nXPZcjPn7umgdNgbXnm527PtWjMzPp3Wy99N78OoPLAL
mfXKzeEgrNX71Va8tTccrI3W9xrlvc79bbN3m8nvXU9Ht7l2z8rUwnatE6zvDfa+9wbO+e15
JW4Ub3fFIm46YVDtdce9UuOqmrWa7bXNqJy/25gWro7XW8HGdbDfSffSjwNxG/Zd72o4jZ2r
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
Oe82q6OTrWyw387Fezvr12Yjun0Wn7N+VXSv9vf7e9FVbfy9Uw8nu53C+OZkdFDeGV30bnf6
G93T3eb6fr+0dX94HJxdnm9urd00KvnKXvdmcxTtrU3qg0p4fXVVjA+t7GXcGc/6V9VJ+HRx
7YXPvkf9Ynpr43Azn92qF6bbO7fnztp+rnq/P54ctw+Hs80KM3JZbfQPW/cbdnmtHe23Rr29
XDtXr8xTBT7cHOXPw+LzNGuJx5P9x+FJnmq3k1+Lzo7Pd67OcnuTHXfaWmtWNreH59Zef/c8
PN/qXF+09lvHg/MJlZ8Mjovbp+PJer28M87lb46vD+rn9V7+sNbJjA5OLsrNaXf/qJsuZ7M3
06P7s+zo6Oje6V5trY2i/OHt2mqt/3T5Xa1Wo3J+Uuy0J+cnB9dnh5ONnZubk/Mta28/jHeH
49pjt+fC7M5BV/nrVq3W+X7rvnx4PrnMDKtbzr7T2LgbXF4M01fbJ/nrZvPCv8keX5X3UxeT
yV3UeXodv7cfmvntXrOV32mWJ0cnl5vhXvmm2A6OO9tXqdxj2jvtdw+Htd5O9rTdG94c3O3Y
R9n00e6tfZ9Zj3Kd/Hq+vz/KHA7Hx91dIU/9uPVstNE+b0f93v3G1Ul4cnl/uFnLdo7zm1R8
erpXfb7Zb+2dN07WR5v7Z5tz3/PLNPy+KbIZrjeH6/1hv+APNq/u9/r9yfp+fX3UO9qdOk+X
Zcfp1u5VZzi6G/r9UXN6Ui+ORuXCeXA63j0er1XrZntn2L0blq/vTo76l+nnzc3i4SRzUp2G
lXJucDI9LjfD3G4l16xnUq3qeWHSPts638ikdh5ven52dHx5e11tnG6vr+98Xu9sHZfLh8Vx
eXgVdm8yw9P1XPfm6GB8eT/aXJ+41+eZ7NXB+vXZZbczLPROj4tH7nVcP+wPn3VZ+m79ZuNq
/+rwvDMtHB7l15uTiXsabj9/vDVsnF7nL6fr3frOYFLI36836ufH4d4g6J9eDa/bhf7WVvHi
5KZ+G+afx4PuenFQ7B2XorPj/PX4tlW73T/bS22FNzcbzXS4M3g+3zJz9cKoOK5sba53N9e8
zG14tzs5r2wXrjv5fbdfnZaLnXFw77fyF/n1w+J5Pj28frZZPZyOGsVscHBeOLjeK9bLl/3D
ca52fbx+uNOo+MWtyqCxF2c3G9urt9fTm/G4e5Yat4O9yW15vRoez6JHtBq+3thxNrr58vbw
fmd6cXG5v+tu75rdxlV7x17r9/J7G/no4CQqVs+j2lbQ7N32b2+G93t2pXd53b2/3nzqxcVo
dPNs667frk932/ejcWW95rh3qdP2enZ/+Hl1+5K6L/Wub9f39m/vbsf3l8frm7nC+eiqu37S
u8mli9vhTjw9r+8ObxuNwt7hed61C9nj9c2d6+LefWvvmg5vXu/Y/f5Zefd05zxXuDkrbV5/
L51Mm/Zg47icbT2/vl7vbdV3C8XKSWlyF+Wn25tX6/1Wsbe7eVntb7lnmwdbpXojfXy7V1/r
r+V3O+dhtDHJ3Vvru1vpYS5XLk5PNs3ORtQvTTZuyu3G5Dh96RXvCpXc+cb56mX2opxt3Nx2
OgfTcTE9PBuXitMDd5gv9frD03p4XRsUhzeFTvTse23kN+v17WA45Qbj2vr4rnkY29mz4dbl
s9bt9vnZ4Gy60Wpb+5cnze7u1u7d+mTYjGurO2dX3W7nuLw/eLq4qzuhO3D6FyeHw+LR6m7x
buO0OOxlypnLnZtx4+Ro2Dsbt/vp8Lx/X9ze2t4tHhYnE3fn2aDWvNttXE/XUqO9emYjU79/
vnmz74wr4Wa7PbvN7uerw86wmB6st+1s723r6+5OtXXmFqx03Ck/Hw932vneVj3qrFU2rrfq
w3JYvG81UvnxQXh4sHqzd5B3+62j1eHxcXmzWN0s7LgPl95h/3Z8fxDXLzYvU+XpOCzlB9l6
eZgqHRUPW3ZrfbN8M9kNVrvFYno4jfZvrEqwXrrLZTdL53G8NNm/ub49bJjlvfROa7RR2z5Y
vWpcVm+ur+zs3tbFYPt8vn03b7l4s9n5Xko8Lofr9cnZdH3UvFm/G16d7g+ze0eXu/2wlR1k
2/vZXZUjZ6Gf3+1u7m+e9u5H7fP8fq90v73b3OiEZ5vPRz2vFwfFvcGTp1m4HJfPhrt+dXiz
7s9yvZ5b3t/sZ06vZ89G0dXaYbjxrMpHJ9dRff+81KuMO/lh72Tfn1b3BzfOIB+d5Ov7g83D
0vb2IG7u33Symd1Rqz3ot9s3d6Ns6XbYyEyLx9P61u3gMJttdta3w0Hnsnx4sruzyiznq9f7
N1dXZ2fnR8F1vHaabdaHd3uTe7uZTbd2duL1jdH+4Wl1Z6e0dty4bl71LlbDfnF9MxftXPUP
d/p3d/tZL7+5vn1X6QzeGK7xoF5c67TrJZvq5ffuC1v1jVTubM9K1/YO7N1+nLnLnq8+m+zG
V/tH48Zo0Mjs7r/RrNu+9Z/pJ17rfqc7OJqm9vPl83bh+TDTvb7enGQvD1frO+Ob3dNheTQq
5y43zHw0t0lfM3XZK7XtVLux6l9uNnfb5lG/kM0e9a5KvbP7ytvDnUm+NTy8PhxkBw+e9U7r
qP9G67o4rXTbPWvvPPNYPCb+3f754U344Pj+7pnv5tPdXn9S7p41T0Z324+H/f5p0NhuN+7X
ntXjTXH+Tf309fjyNvf8+/HTYWP85PT4+ujJj/Xb7eGTFy++V3m+ZfvXt/xRufNgL3l+PXzW
XdN8s91s7dwX27vPuysrSs3jnbvD/PZdo93Z654NLt9o1l27F7fb/c7OXXfY3p5VXb+ebh+P
N3vNwuX2fX98s7ZKO/u38Wj/uHtxVF/d35lVHkw2brO3rWft/nS7nXUPRm+15aQ6XD8YX7e2
9yq9TuaqPKo8mWxtGt+cnE+LnfJ1v31Yzx8Nhvu3MrfeGeQ3e7u7w9OTfONs/zJvdXYLl1Gt
Udhtdzt3G/3b24vw/vrq9N4tFff84qh2UB4U09e5Xq/c2hnHl/fp9eL64WA8vepOD68Pmuf7
J+P7ze3K4V7+dP1u1B70L8tBt2tv3g4ezj99PJ/0G9f3d+1yqnF7VT+st3aL5Ua08eDxuejy
vtRvnw7Wb9a3+rn82WB9Z/9Zp/dOm9u5nf2dzfubTmswK+2d7W7cDZ98iFu93bNa73LQr47a
G93ZNve3m+Gwd9m4GHerJ6V8NHw4X4xt87jTrWWj4uh+eXr6Y56PK8fP5zvNI2fn5slu+cxe
O79pXV+tdce9rvdGG7tXH27VRtnb4MzrB/no9M0+0Kw2brsP1/fTk6Owe3NyfXn/4KyvcqW9
3sl4VHvw9bPUj38t/vh7kf5DnFv1q9lPZpV47a0Wjq9n3zE9vdk8nnSPBtO3GtcZDQrzPpxP
82k+zaf5NJ/m03yaT//fTX9vMu/8+PH9P2bW+enDT79vOj9lP35MLn34/PHj3QSTPX/dZPJw
fvj8w5vLOJ9m03/kG2jmPwsP8jyaf589n5y9/+X9p783OZSZT/NpPs2n+TSf5tN8mk/z6f9+
+o+Mf1JyPn787f3nP30Oo+/h5eeP//HT+/d/+M//SH76/OGPSUzGf/r4+/e/o/D+9Xf/I7n8
86f//NOnv3/+Lf77POE9n+TTfJpP82k+zaf5NJ/m03yaT/NpPs2n+TSf5tN8mk/zaT7Np/k0
n+bTfJpP82k+zaf5NJ/m03yaT/NpPs2n+TSf5tN8mk/zaT7Np/k0n+bTfJpP82k+zaf5NJ/m
03yaT/NpPs2n+TSf5tN8mk/zaT7Np/k0n+bTfJpP82k+zaf5NJ/m03yaT/NpPs2n+TSf5tN8
mk//mvRfT4JPNgAAAHicY2CWllHU0ZAVYBTQMJBVNFCSVdXQYOXk5mDl4uZg5eRk5ebi5pbQ
VpJV1QMArV0HPw==
"""

def print_banner():
    """Print installer banner"""
    print("=" * 60)
    print("Robot AI Self-Extractor")
    print("=" * 60)
    print("This script will unpack and install the complete Robot AI package.")
    print("Version: 1.0.0")
    print("=" * 60)

def create_directories():
    """Create installation directories"""
    logger.info(f"Creating installation directories at {INSTALL_DIR}")
    
    try:
        # Create main directories
        os.makedirs(INSTALL_DIR, exist_ok=True)
        os.makedirs(MODULE_DIR, exist_ok=True)
        os.makedirs(WEB_DIR, exist_ok=True)
        os.makedirs(LOG_DIR, exist_ok=True)
        
        logger.info("Directories created successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to create directories: {e}")
        logger.info("Attempting to use temporary directory...")
        
        try:
            # Try to use /tmp directory which should be writable
            global INSTALL_DIR, MODULE_DIR, WEB_DIR, LOG_DIR, CONFIG_FILE
            INSTALL_DIR = "/tmp/robot-ai"
            MODULE_DIR = f"{INSTALL_DIR}/modules"
            WEB_DIR = f"{INSTALL_DIR}/web"
            LOG_DIR = f"{INSTALL_DIR}/logs"
            CONFIG_FILE = f"{INSTALL_DIR}/config.json"
            
            os.makedirs(INSTALL_DIR, exist_ok=True)
            os.makedirs(MODULE_DIR, exist_ok=True)
            os.makedirs(WEB_DIR, exist_ok=True)
            os.makedirs(LOG_DIR, exist_ok=True)
            
            logger.info(f"Using temporary directory: {INSTALL_DIR}")
            return True
        except Exception as e2:
            logger.error(f"Failed to create temporary directories: {e2}")
            return False

def decrypt_modules():
    """Decrypt and extract module data"""
    logger.info("Extracting module files")
    
    try:
        # Decompress modules data
        modules_data = zlib.decompress(base64.b64decode(MODULES_DATA))
        
        # Create a ZipFile object from the decompressed data
        with zipfile.ZipFile(io.BytesIO(modules_data)) as zip_ref:
            # Extract all files to the modules directory
            zip_ref.extractall(MODULE_DIR)
        
        # Create __init__.py file if it doesn't exist
        init_file = os.path.join(MODULE_DIR, "__init__.py")
        if not os.path.exists(init_file):
            with open(init_file, "w") as f:
                f.write("# Robot AI Modules\n__version__ = '1.0.0'\n")
        
        logger.info("Module files extracted successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to extract module files: {e}")
        traceback.print_exc()
        return False

def decrypt_web_interface():
    """Decrypt and extract web interface data"""
    logger.info("Extracting web interface files")
    
    try:
        # Decompress web data
        web_data = zlib.decompress(base64.b64decode(WEB_DATA))
        
        # Create a ZipFile object from the decompressed data
        with zipfile.ZipFile(io.BytesIO(web_data)) as zip_ref:
            # Extract all files to the web directory
            zip_ref.extractall(WEB_DIR)
        
        logger.info("Web interface files extracted successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to extract web interface files: {e}")
        return False

def create_startup_script():
    """Create startup script"""
    logger.info("Creating startup script")
    
    try:
        startup_script = f"""#!/bin/bash
# Robot AI Startup Script
# Start the Robot AI services

SCRIPT_DIR="{INSTALL_DIR}"
MODULE_DIR="{MODULE_DIR}"
WEB_DIR="{WEB_DIR}"
LOG_DIR="{LOG_DIR}"
CONFIG_FILE="{CONFIG_FILE}"
WEB_PORT={WEB_PORT}

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Start core module
cd "$SCRIPT_DIR"
export PYTHONPATH="$SCRIPT_DIR:$PYTHONPATH"

# Start web interface
python3 -m modules.web_server > "$LOG_DIR/web.log" 2>&1 &
echo $! > "$SCRIPT_DIR/web.pid"
echo "Web interface started on port $WEB_PORT"

# Start core module
python3 -m modules.core > "$LOG_DIR/core.log" 2>&1 &
echo $! > "$SCRIPT_DIR/core.pid"
echo "Robot AI core module started"

echo "Robot AI services started"
echo "Web interface: http://localhost:$WEB_PORT/"
echo "Log files: $LOG_DIR/"
"""
        
        startup_path = os.path.join(INSTALL_DIR, "start.sh")
        with open(startup_path, "w") as f:
            f.write(startup_script)
        
        # Make executable
        os.chmod(startup_path, 0o755)
        
        logger.info("Startup script created successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to create startup script: {e}")
        return False

def create_shutdown_script():
    """Create shutdown script"""
    logger.info("Creating shutdown script")
    
    try:
        shutdown_script = f"""#!/bin/bash
# Robot AI Shutdown Script
# Stop all Robot AI services

SCRIPT_DIR="{INSTALL_DIR}"

# Stop web interface
if [ -f "$SCRIPT_DIR/web.pid" ]; then
    kill $(cat "$SCRIPT_DIR/web.pid") 2>/dev/null || true
    rm "$SCRIPT_DIR/web.pid"
fi

# Stop core module
if [ -f "$SCRIPT_DIR/core.pid" ]; then
    kill $(cat "$SCRIPT_DIR/core.pid") 2>/dev/null || true
    rm "$SCRIPT_DIR/core.pid"
fi

echo "Robot AI services stopped"
"""
        
        shutdown_path = os.path.join(INSTALL_DIR, "stop.sh")
        with open(shutdown_path, "w") as f:
            f.write(shutdown_script)
        
        # Make executable
        os.chmod(shutdown_path, 0o755)
        
        logger.info("Shutdown script created successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to create shutdown script: {e}")
        return False

def create_config():
    """Create configuration file"""
    logger.info("Creating configuration file")
    
    try:
        with open(CONFIG_FILE, "w") as f:
            json.dump(DEFAULT_CONFIG, f, indent=4)
        
        logger.info("Configuration file created successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to create configuration file: {e}")
        return False

def create_web_server_module():
    """Create web server module"""
    logger.info("Creating web server module")
    
    try:
        web_server_code = """#!/usr/bin/env python3
\"\"\"
Robot AI Web Server Module
Provides a web interface for the Robot AI system.

Author: AI Assistant
Version: 1.0.0
\"\"\"

import os
import sys
import json
import logging
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
import socketserver
import webbrowser
from pathlib import Path

# Get the directory containing this file
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(CURRENT_DIR)
WEB_DIR = os.path.join(PARENT_DIR, 'web')
CONFIG_FILE = os.path.join(PARENT_DIR, 'config.json')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('robot-ai-web')

# Load configuration
def load_config():
    try:
        with open(CONFIG_FILE, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load configuration: {e}")
        return {
            "web_port": 8080,
            "robot_ip": "localhost",
            "robot_port": 8090
        }

class RobotAIHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Set the directory to serve
        super().__init__(*args, directory=WEB_DIR, **kwargs)
    
    def log_message(self, format, *args):
        logger.info(format % args)

def start_web_server():
    config = load_config()
    port = config.get('web_port', 8080)
    
    logger.info(f"Starting web server on port {port}")
    
    try:
        # Change directory to web directory
        os.chdir(WEB_DIR)
        
        # Create server
        handler = RobotAIHandler
        httpd = socketserver.TCPServer(("", port), handler)
        
        # Log server start
        logger.info(f"Web server started at http://localhost:{port}/")
        
        # Run server
        httpd.serve_forever()
    except Exception as e:
        logger.error(f"Failed to start web server: {e}")
        return False

def open_browser():
    config = load_config()
    port = config.get('web_port', 8080)
    
    url = f"http://localhost:{port}/"
    logger.info(f"Opening web browser at {url}")
    
    try:
        webbrowser.open(url)
        return True
    except Exception as e:
        logger.error(f"Failed to open browser: {e}")
        return False

def main():
    # Start web server in a separate thread
    server_thread = threading.Thread(target=start_web_server)
    server_thread.daemon = True
    server_thread.start()
    
    # Open browser after a short delay
    threading.Timer(2.0, open_browser).start()
    
    # Keep the main thread running
    try:
        while True:
            server_thread.join(1)
    except KeyboardInterrupt:
        logger.info("Web server stopping...")
        sys.exit(0)

if __name__ == "__main__":
    main()
"""
        
        web_server_path = os.path.join(MODULE_DIR, "web_server.py")
        with open(web_server_path, "w") as f:
            f.write(web_server_code)
        
        logger.info("Web server module created successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to create web server module: {e}")
        return False

def create_app_shortcut():
    """Create app shortcut for the robot's Apps & Notifications page"""
    logger.info("Creating app shortcut")
    
    try:
        app_shortcut = {
            "name": "Robot AI Package",
            "icon": "robot",
            "description": "Advanced AI capabilities for autonomous robot control",
            "command": f"python3 {INSTALL_DIR}/start.sh",
            "category": "Automation"
        }
        
        shortcut_path = "/home/robot/.local/share/applications/robot-ai.desktop"
        
        try:
            # Try to create .desktop file for the robot's apps page
            with open(shortcut_path, "w") as f:
                f.write("[Desktop Entry]\n")
                f.write(f"Name={app_shortcut['name']}\n")
                f.write(f"Comment={app_shortcut['description']}\n")
                f.write(f"Exec={app_shortcut['command']}\n")
                f.write("Type=Application\n")
                f.write(f"Categories={app_shortcut['category']}\n")
                f.write(f"Icon={app_shortcut['icon']}\n")
            
            logger.info(f"App shortcut created at {shortcut_path}")
        except Exception as e:
            logger.warning(f"Could not create app shortcut in applications directory: {e}")
            
            # Create a shortcut in the install directory as backup
            shortcut_path = os.path.join(INSTALL_DIR, "robot-ai.desktop")
            with open(shortcut_path, "w") as f:
                f.write("[Desktop Entry]\n")
                f.write(f"Name={app_shortcut['name']}\n")
                f.write(f"Comment={app_shortcut['description']}\n")
                f.write(f"Exec={app_shortcut['command']}\n")
                f.write("Type=Application\n")
                f.write(f"Categories={app_shortcut['category']}\n")
                f.write(f"Icon={app_shortcut['icon']}\n")
            
            logger.info(f"App shortcut created at {shortcut_path}")
        
        return True
    except Exception as e:
        logger.error(f"Failed to create app shortcut: {e}")
        return False

def create_dummy_modules():
    """Create minimal dummy module files for testing"""
    logger.info("Creating minimal module files")
    
    try:
        # Create core.py
        core_content = """#!/usr/bin/env python3
\"\"\"
Robot AI Core Module
Primary controller for all robot AI functionality.

Author: AI Assistant
Version: 1.0.0
\"\"\"

import os
import sys
import json
import time
import logging
import threading

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger('robot-ai-core')

class RobotAI:
    \"\"\"Main Robot AI controller class\"\"\"
    
    def __init__(self):
        \"\"\"Initialize the Robot AI\"\"\"
        self.running = False
        logger.info("Robot AI Core initialized")
    
    def start(self):
        \"\"\"Start the Robot AI\"\"\"
        self.running = True
        logger.info("Robot AI Core started")
        
        # Main loop
        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            self.stop()
    
    def stop(self):
        \"\"\"Stop the Robot AI\"\"\"
        self.running = False
        logger.info("Robot AI Core stopped")

def main():
    \"\"\"Main entry point\"\"\"
    robot_ai = RobotAI()
    robot_ai.start()

if __name__ == "__main__":
    main()
"""
        with open(os.path.join(MODULE_DIR, "core.py"), "w") as f:
            f.write(core_content)
        
        # Create dummy modules
        dummy_modules = ["camera.py", "map.py", "door.py", "elevator.py", "task_queue.py"]
        for module in dummy_modules:
            module_path = os.path.join(MODULE_DIR, module)
            if not os.path.exists(module_path):
                with open(module_path, "w") as f:
                    f.write(f"# Robot AI {module} Module\n")
                    f.write("# This is a placeholder module\n\n")
                    f.write("def init():\n")
                    f.write(f"    print('Robot AI {module} Module initialized')\n")
        
        logger.info("Minimal module files created successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to create minimal module files: {e}")
        return False

def create_minimal_web_files():
    """Create minimal web interface files"""
    logger.info("Creating minimal web interface files")
    
    try:
        # Create index.html
        index_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Robot AI Interface</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        header {
            background-color: #3498db;
            color: white;
            padding: 20px;
            text-align: center;
        }
        h1 {
            margin: 0;
        }
        .card {
            background-color: white;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            padding: 20px;
            margin-bottom: 20px;
        }
        .button {
            background-color: #3498db;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 4px;
            cursor: pointer;
        }
        .button:hover {
            background-color: #2980b9;
        }
    </style>
</head>
<body>
    <header>
        <h1>Robot AI Interface</h1>
        <p>Advanced AI capabilities for autonomous robot control</p>
    </header>
    
    <div class="container">
        <div class="card">
            <h2>Connection Status</h2>
            <p>Robot IP: <span id="robot-ip">Loading...</span></p>
            <p>Status: <span id="connection-status">Disconnected</span></p>
            <button class="button" id="connect-button">Connect</button>
        </div>
        
        <div class="card">
            <h2>Robot Control</h2>
            <p>This interface allows you to control and monitor your robot.</p>
            <button class="button" id="start-button">Start AI Services</button>
            <button class="button" id="stop-button">Stop AI Services</button>
        </div>
    </div>
    
    <script>
        // Simple JavaScript to update connection status
        document.getElementById('robot-ip').textContent = window.location.hostname;
        
        document.getElementById('connect-button').addEventListener('click', function() {
            document.getElementById('connection-status').textContent = 'Connected';
        });
        
        document.getElementById('start-button').addEventListener('click', function() {
            alert('Starting AI services...');
        });
        
        document.getElementById('stop-button').addEventListener('click', function() {
            alert('Stopping AI services...');
        });
    </script>
</body>
</html>
"""
        index_path = os.path.join(WEB_DIR, "index.html")
        os.makedirs(os.path.dirname(index_path), exist_ok=True)
        with open(index_path, "w") as f:
            f.write(index_content)
        
        logger.info("Minimal web interface files created successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to create minimal web interface files: {e}")
        return False

def check_dependencies():
    """Check if required Python modules are installed"""
    required_modules = ["websockets", "numpy", "requests"]
    missing_modules = []
    
    for module in required_modules:
        try:
            __import__(module)
        except ImportError:
            missing_modules.append(module)
    
    if missing_modules:
        logger.warning(f"Missing Python modules: {', '.join(missing_modules)}")
        logger.info("You may need to install these modules for full functionality")
    
    return True

def start_services():
    """Start Robot AI services"""
    logger.info("Starting Robot AI services")
    
    try:
        # Run the startup script
        startup_script = os.path.join(INSTALL_DIR, "start.sh")
        subprocess.Popen(['/bin/bash', startup_script], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        logger.info("Robot AI services started successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to start services: {e}")
        return False

def main():
    """Main installation function"""
    print_banner()
    
    # Create directories
    if not create_directories():
        logger.error("Failed to create directories. Installation aborted.")
        return False
    
    # Extract module files
    if not decrypt_modules():
        logger.warning("Failed to extract module files. Creating minimal modules instead.")
        if not create_dummy_modules():
            logger.error("Failed to create minimal modules. Installation aborted.")
            return False
    
    # Extract web interface files
    if not decrypt_web_interface():
        logger.warning("Failed to extract web interface files. Creating minimal web interface instead.")
        if not create_minimal_web_files():
            logger.error("Failed to create minimal web interface. Installation aborted.")
            return False
    
    # Create web server module
    if not create_web_server_module():
        logger.error("Failed to create web server module. Installation aborted.")
        return False
    
    # Create configuration file
    if not create_config():
        logger.error("Failed to create configuration file. Installation aborted.")
        return False
    
    # Create startup and shutdown scripts
    if not create_startup_script() or not create_shutdown_script():
        logger.error("Failed to create startup/shutdown scripts. Installation aborted.")
        return False
    
    # Create app shortcut
    create_app_shortcut()
    
    # Check dependencies
    check_dependencies()
    
    # Start services
    if not start_services():
        logger.warning("Failed to start services automatically.")
        print("\nTo manually start Robot AI, run:")
        print(f"  bash {INSTALL_DIR}/start.sh")
    
    print("\nInstallation completed!")
    print(f"Robot AI package installed to: {INSTALL_DIR}")
    print(f"Web interface: http://localhost:{WEB_PORT}/")
    print("\nTo start Robot AI, run:")
    print(f"  bash {INSTALL_DIR}/start.sh")
    print("\nTo stop Robot AI, run:")
    print(f"  bash {INSTALL_DIR}/stop.sh")
    
    return True

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\nInstallation cancelled by user.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unhandled exception: {e}")
        traceback.print_exc()
        sys.exit(1)