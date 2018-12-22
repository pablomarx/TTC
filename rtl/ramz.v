`timescale 1ns / 1ps 
module ramz(
	input clka,
	input [6:0] addra,
	input wea,
	input [31:0] dina,
	
	input clkb,
	input [6:0] addrb,
	output reg [31:0] doutb
);

SB_RAM40_4K mem_lo (
   .RDATA(doutb[15:0]),
   .RADDR({4'b0, addrb[6:0]}),
   .RCLK(clkb),
   .RCLKE(1'b1),
   .RE(1'b1),
   
   .WDATA(dina[15:0]),
   .WADDR({4'b0, addra[6:0]}),
   .WCLK(clka),
   .WCLKE(1'b1),
   .WE(wea),
);
SB_RAM40_4K mem_hi (
   .RDATA(doutb[31:16]),
   .RADDR({4'b0, addrb[6:0]}),
   .RCLK(clkb),
   .RCLKE(1'b1),
   .RE(1'b1),
   
   .WDATA(dina[31:16]),
   .WADDR({4'b0, addra[6:0]}),
   .WCLK(clka),
   .WCLKE(1'b1),
   .WE(wea),
);

endmodule
 
