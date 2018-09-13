DEVICE=1k
PACKAGE=tq144

PCF=Icestick.pcf

ARACHNE = arachne-pnr
ARACHNE_ARGS = -s 2
ICEPACK = icepack
ICETIME = icetime
ICEPROG = iceprog

SOURCES = $(wildcard *.v)

all: tinycomp.bin

tinycomp.blif:  $(SOURCES)
	yosys -ql tinycomp.log -p 'synth_ice40 -top Top -blif $@'  $^

tinycomp_syn.v: tinycomp.blif
	yosys -p 'read_blif -wideports $^; write_verilog $@'

tinycomp.asc: tinycomp.blif
	$(ARACHNE) $(ARACHNE_ARGS) -d $(DEVICE) -P $(PACKAGE) -p $(PCF) -o $@ < $^

tinycomp.bin: tinycomp.asc
	$(ICEPACK) tinycomp.asc tinycomp.bin

prog: tinycomp.bin 
	$(ICEPROG) tinycomp.bin

# ---- Clean ----

clean:
	rm -f tinycomp.blif tinycomp.log tinycomp.asc tinycomp.rpt tinycomp.bin

.PHONY: prog  clean
